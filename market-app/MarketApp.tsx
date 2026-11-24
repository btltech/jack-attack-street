import { useEffect, useRef, useState } from 'react';
import { bestDeal, letters, makeRounds, money, objectiveLabel, score, settle, utcDate } from './engine';
import type { Deal, Round } from './engine';

type Run = { choices: number[]; revealed: boolean };
const emptyRun = (): Run => ({ choices: [], revealed: false });
const storageKey = 'market-margin-v1';

function dailyRun(day: string): Run {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey + ':' + day) ?? 'null');
    if (Array.isArray(value?.choices) && value.choices.length <= 3 &&
      value.choices.every((choice: unknown) => choice === 0 || choice === 1 || choice === 2) &&
      typeof value.revealed === 'boolean' && (!value.revealed || value.choices.length > 0)) {
      return value;
    }
  } catch { /* A restricted browser can still play. */ }
  return emptyRun();
}

function Receipt({ deal }: { deal: Deal }) {
  const result = settle(deal);
  return (
    <dl className="receipt">
      <div><dt>Sales · {deal.sold} × {money(deal.unitPrice)}</dt><dd>{money(result.revenue)}</dd></div>
      <div><dt>All stock bought</dt><dd>{money(-result.stockPaid)}</dd></div>
      <div><dt>Pitch + card fees</dt><dd>{money(-(deal.overhead + result.cardFees))}</dd></div>
      <div className="receipt-total"><dt>Cash today</dt><dd>{money(result.cash)}</dd></div>
      {result.unsold > 0 && (
        <>
          <div><dt>{result.unsold} unsold · at cost</dt><dd>{money(result.stockLeft)}</dd></div>
          <div className="receipt-total"><dt>Trading profit</dt><dd>{money(result.profit)}</dd></div>
        </>
      )}
    </dl>
  );
}

function DealCard({ deal, index, picked, submitted, best, objective, onPick }: {
  deal: Deal; index: number; picked: boolean; submitted: boolean; best: boolean;
  objective: Round['objective']; onPick: () => void;
}) {
  const totals = settle(deal);
  return (
    <article className={`deal ${picked ? 'picked' : ''} ${submitted && best ? 'winner' : ''}`}>
      <div className="deal-top">
        <span className="deal-letter">{letters[index]}</span>
        {submitted && <span className="deal-marker">{best ? 'Best deal' : picked ? 'Your pick' : ''}</span>}
      </div>
      <h3>{deal.name}</h3>
      <dl className="deal-details">
        <div><dt>Buy {deal.bought} units</dt><dd>{money(deal.unitCost)} each</dd></div>
        <div><dt>Sell {deal.sold} units</dt><dd>{money(deal.unitPrice)} each</dd></div>
        <div><dt>Pitch fee</dt><dd>{money(deal.overhead)}</dd></div>
        {deal.cardFee > 0 && <div><dt>Card fee per sale</dt><dd>{money(deal.cardFee)}</dd></div>}
      </dl>
      {submitted ? (
        <>
          <div className="revealed-total"><span>{objectiveLabel[objective]}</span><strong>{money(totals[objective])}</strong></div>
          <details><summary>View receipt</summary><Receipt deal={deal} /></details>
        </>
      ) : (
        <label className="pick">
          <input type="radio" name="deal" value={index} checked={picked} onChange={onPick} />
          <span>{picked ? 'Selected' : 'Select deal ' + letters[index]}</span>
        </label>
      )}
    </article>
  );
}

export function MarketApp() {
  const [day, setDay] = useState(utcDate);
  const [daily, setDaily] = useState(() => dailyRun(day));
  const [practice, setPractice] = useState<Run>(emptyRun);
  const [practiceSeed, setPracticeSeed] = useState(() => Math.random().toString(36));
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const [pick, setPick] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLHeadingElement>(null);
  const focusBoard = useRef(false);
  const rounds = makeRounds(mode === 'daily' ? day : practiceSeed);
  const run = mode === 'daily' ? daily : practice;
  const finished = !run.revealed && run.choices.length === rounds.length;
  const roundIndex = run.revealed ? run.choices.length - 1 : run.choices.length;
  const round = rounds[roundIndex];
  const correct = score(rounds, run.choices);
  const savedDay = new Date(day + 'T12:00:00Z');
  const dateLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(savedDay);

  useEffect(() => {
    function updateDay() {
      const today = utcDate();
      if (today !== day) {
        setDay(today);
        setDaily(dailyRun(today));
        setPick(null);
        setShareStatus('');
      }
    }
    const timer = window.setInterval(updateDay, 30_000);
    window.addEventListener('focus', updateDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateDay);
    };
  }, [day]);

  useEffect(() => {
    if (focusBoard.current) {
      board.current?.focus();
      focusBoard.current = false;
    }
  }, [roundIndex, finished, mode, practiceSeed]);

  function updateRun(next: Run) {
    if (mode === 'practice') {
      setPractice(next);
    } else {
      setDaily(next);
      try { localStorage.setItem(storageKey + ':' + day, JSON.stringify(next)); } catch { /* Keep playing. */ }
    }
  }

  function changeMode(next: 'daily' | 'practice') {
    if (next === mode) return;
    setMode(next);
    setPick(null);
    setShareStatus('');
    focusBoard.current = true;
  }

  function currentAction() {
    if (run.revealed) {
      focusBoard.current = true;
      setPick(null);
      updateRun({ ...run, revealed: false });
    } else if (pick !== null && !finished) {
      updateRun({ choices: [...run.choices, pick], revealed: true });
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }

  function restartPractice() {
    setPractice(emptyRun());
    setPracticeSeed(Math.random().toString(36));
    setMode('practice');
    setPick(null);
    setShareStatus('');
    focusBoard.current = true;
  }

  async function share() {
    const marks = run.choices.map((choice, index) => choice === bestDeal(rounds[index]) ? '✓' : '·').join(' ');
    const message = `Market Margin · ${dateLabel}\n${correct}/3 best deals  ${marks}\nhttps://www.jackattackstreets.com/market-margin/`;
    try {
      await navigator.clipboard.writeText(message);
      setShareStatus('Result copied.');
    } catch {
      setShareStatus(message);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell bar-inner">
          <a className="brand" href="/" aria-label="Jack Attack Streets home"><span className="brand-mark" aria-hidden="true">J</span> JACK ATTACK STREETS</a>
          <a className="back" href="/">← All games</a>
        </div>
      </header>
      <main className="shell">
        <section className="hero" aria-labelledby="game-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> The daily trading puzzle</p>
            <h1 id="game-title">Market<span> Margin</span><b>.</b></h1>
            <p className="intro">Three deals. Pick the strongest trade, then see the numbers on the receipt.</p>
          </div>
          <div className="hero-image" aria-hidden="true" />
        </section>

        <div className="mode-bar">
          <nav className="modes" aria-label="Game mode">
            <button aria-pressed={mode === 'daily'} onClick={() => changeMode('daily')}>Daily market</button>
            <button aria-pressed={mode === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
          </nav>
          <span className="date-label">{mode === 'daily' ? dateLabel : 'Random trades'}</span>
        </div>

        {finished ? (
          <section className="finish" aria-labelledby="finish-title">
            <p className="eyebrow">Market closed</p>
            <h2 id="finish-title" ref={board} tabIndex={-1}>You found <em>{correct} of {rounds.length}</em> best deals.</h2>
            <div className="finish-rounds">
              {rounds.map((item, index) => (
                <details key={item.market}>
                  <summary><span>{item.title}</span><strong>{run.choices[index] === bestDeal(item) ? 'Best deal' : 'Review trade'}</strong></summary>
                  <p>Your pick was <b>{item.deals[run.choices[index]].name}</b>. The best deal was <b>{item.deals[bestDeal(item)].name}</b>.</p>
                  <Receipt deal={item.deals[bestDeal(item)]} />
                </details>
              ))}
            </div>
            <div className="finish-actions">
              {mode === 'daily' && <button className="primary" onClick={share}>Copy daily result</button>}
              <button className={mode === 'daily' ? 'secondary' : 'primary'} onClick={restartPractice}>Play new practice round</button>
            </div>
            {mode === 'daily' && <p className="small-note">A new market opens at midnight UTC.</p>}
            <p className="share-status" role="status">{shareStatus}</p>
          </section>
        ) : (
          <section className="game" aria-labelledby="round-title">
            <div className="game-head">
              <div>
                <p className="eyebrow muted">{round.market} <span>·</span> Trade {roundIndex + 1} of {rounds.length}</p>
                <h2 id="round-title" ref={board} tabIndex={-1}>{round.title}</h2>
              </div>
              <div className="objective"><span>Goal</span><strong>{round.objective === 'cash' ? 'Most cash left today' : 'Highest trading profit'}</strong></div>
            </div>
            <p className="round-hint">{round.objective === 'cash'
              ? 'Count the cost of everything you buy today, including stock you don’t sell.'
              : 'Count only the stock you sell as a cost. Unsold stock stays in your inventory.'}</p>
            <fieldset>
              <legend className="sr-only">Choose the best deal</legend>
              <div className="deals">
                {round.deals.map((deal, index) => <DealCard key={deal.name} deal={deal} index={index}
                  picked={(run.revealed ? run.choices[roundIndex] : pick) === index}
                  submitted={run.revealed} best={bestDeal(round) === index} objective={round.objective}
                  onPick={() => setPick(index)} />)}
              </div>
            </fieldset>
            {run.revealed && (() => {
              const winner = bestDeal(round);
              const chosen = run.choices[roundIndex];
              const difference = settle(round.deals[winner])[round.objective] - settle(round.deals[chosen])[round.objective];
              return <div className="feedback" ref={feedback} tabIndex={-1} role="status">
                <strong>{winner === chosen ? 'You picked the best deal.' : `Deal ${letters[winner]} was ${money(difference)} better.`}</strong>
                <span>{round.objective === 'cash'
                  ? 'Cash is sales minus everything you paid out today.'
                  : 'Trading profit adds the cost of unsold stock back to today’s cash result.'}</span>
              </div>;
            })()}
            <div className="action-bar">
              <p>{run.revealed ? `${correct} best deal${correct === 1 ? '' : 's'} found` : 'Choose one deal to reveal the numbers.'}</p>
              <button className="primary" disabled={!run.revealed && pick === null} onClick={currentAction}>
                {run.revealed ? (roundIndex === rounds.length - 1 ? 'See results' : 'Next trade') : 'Lock in deal'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        <details className="rules">
          <summary>How to play</summary>
          <div>
            <p>Pick the best deal in each of three trades. The goal can change between trades. After each choice, open the receipts to compare your maths.</p>
            <p><b>Cash today</b> is what you took in minus everything you paid out. <b>Trading profit</b> deducts the cost of what sold, plus fees. The game assumes unsold stock is still worth what you paid for it.</p>
            <p>The daily trades are the same for everyone and your picks are saved in this browser. Practice gives you random trades. There’s no timer.</p>
          </div>
        </details>
        <footer><a href="/">Jack Attack Streets</a><a href="/privacy/">Privacy</a></footer>
      </main>
    </>
  );
}
