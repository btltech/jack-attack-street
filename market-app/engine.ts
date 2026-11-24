export type Objective = 'cash' | 'profit';

export interface Deal {
  name: string;
  bought: number;
  sold: number;
  unitCost: number;
  unitPrice: number;
  overhead: number;
  cardFee: number;
}

export interface Round {
  market: string;
  title: string;
  objective: Objective;
  deals: Deal[];
}

const markets = [
  { market: 'Portobello Road', title: 'Saturday citrus', names: ['Blood oranges', 'Clementines', 'Pink grapefruit'] },
  { market: 'Acton Market', title: 'The coffee rush', names: ['House blend', 'Cold brew cans', 'Decaf bags'] },
  { market: 'Brixton Village', title: 'The spice shelf', names: ['Jerk rub', 'Suya spice', 'Smoked paprika'] },
  { market: 'Walthamstow Market', title: 'Flowers at closing', names: ['Tulip bunches', 'Daffodil bunches', 'Mixed bouquets'] },
  { market: 'Deptford Market Yard', title: 'The record crate', names: ['Soul singles', 'Jazz reissues', 'Reggae compilations'] },
  { market: 'Shepherd’s Bush Market', title: 'Fabric by the roll', names: ['Wax-print bundles', 'Cotton remnants', 'Linen offcuts'] },
  { market: 'Brockley Market', title: 'The bakery counter', names: ['Sourdough loaves', 'Sesame rolls', 'Focaccia boxes'] },
  { market: 'Spitalfields Market', title: 'The print stand', names: ['London postcards', 'Risograph prints', 'Pocket notebooks'] },
  { market: 'Greenwich Market', title: 'Small-batch skincare', names: ['Citrus soaps', 'Oat bars', 'Hand balm tins'] },
];

export function settle(deal: Deal) {
  const revenue = deal.sold * deal.unitPrice;
  const stockPaid = deal.bought * deal.unitCost;
  const stockSold = deal.sold * deal.unitCost;
  const unsold = deal.bought - deal.sold;
  const stockLeft = unsold * deal.unitCost;
  const cardFees = deal.sold * deal.cardFee;
  return {
    revenue, stockPaid, stockSold, unsold, stockLeft, cardFees,
    cash: revenue - stockPaid - deal.overhead - cardFees,
    profit: revenue - stockSold - deal.overhead - cardFees,
  };
}

export function bestDeal(round: Round): number {
  return round.deals.reduce((best, deal, index) =>
    settle(deal)[round.objective] > settle(round.deals[best])[round.objective] ? index : best, 0);
}

function randomFrom(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return (min: number, max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return min + Math.floor(state / 4294967296 * (max - min + 1));
  };
}

export function makeRounds(seed: string): Round[] {
  const random = randomFrom('market-margin-v1/' + seed);
  const firstMarket = random(0, markets.length - 1);
  return [0, 1, 2].map(index => {
    const market = markets[(firstMarket + index) % markets.length];
    const objective: Objective = index === 1 ? 'profit' : 'cash';
    const deals: Deal[] = [];
    for (const name of market.names) {
      const unitCost = random(2, 5) * 100;
      const bought = random(8, 18);
      const sold = index === 0 ? bought : bought - random(1, 4);
      const deal: Deal = {
        name, bought, sold, unitCost,
        unitPrice: unitCost + random(2, 5) * 100,
        overhead: random(6, 22) * 100,
        cardFee: index === 2 ? random(2, 5) * 10 : 0,
      };
      const used = deals.map(other => settle(other)[objective]);
      while (used.includes(settle(deal)[objective])) deal.overhead += 100;
      deals.push(deal);
    }
    return { market: market.market, title: market.title, objective, deals };
  });
}

export const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
export const money = (pence: number) => pounds.format(pence / 100).replace(/\.00$/, '');

export const letters = ['A', 'B', 'C'];
export const objectiveLabel = { cash: 'Cash today', profit: 'Trading profit' };

export function score(rounds: Round[], choices: number[]) {
  return choices.filter((choice, index) => choice === bestDeal(rounds[index])).length;
}
