import { PriceService } from "./priceService";
import { pearson } from "../utils/correlation";
import { config } from "../config";

export type CorrelationResult = {
  pair: [string, string];
  value: number;
  ts: number;
  thresholdBreached: boolean;
};

export class CorrelationService {
  constructor(private priceService: PriceService) {}
  async compute(): Promise<CorrelationResult[]> {
    const syms = this.priceService.symbols();
    const results: CorrelationResult[] = [];
    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const aHist = (await this.priceService.history(syms[i])).slice(-config.correlationWindow);
        const bHist = (await this.priceService.history(syms[j])).slice(-config.correlationWindow);
        const aVals = aHist.map(p => p.price);
        const bVals = bHist.map(p => p.price);
        const value = pearson(aVals, bVals);
        results.push({
          pair: [syms[i], syms[j]],
          value,
          ts: Date.now(),
          thresholdBreached: value < config.thresholdLow || value > config.thresholdHigh,
        });
      }
    }
    return results;
  }
}
