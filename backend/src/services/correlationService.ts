import { CandleService } from "./candleService";
import { pearson } from "../utils/correlation";
import { config } from "../config";

export type CorrelationResult = {
  pair: [string, string];
  value: number;
  ts: number;
  thresholdBreached: boolean;
};

export class CorrelationService {
  constructor(private candleService: CandleService) {}

  async compute(): Promise<CorrelationResult[]> {
    const syms = this.candleService.symbols();
    const results: CorrelationResult[] = [];

    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        // ใช้ M15 candle closes แทน raw ticks
        const aCloses = await this.candleService.getCloses(
          syms[i],
          config.strategy.corrMidWindow
        );
        const bCloses = await this.candleService.getCloses(
          syms[j],
          config.strategy.corrMidWindow
        );

        const len = Math.min(aCloses.length, bCloses.length);
        const value = pearson(aCloses.slice(-len), bCloses.slice(-len));

        results.push({
          pair: [syms[i], syms[j]],
          value,
          ts: Date.now(),
          thresholdBreached:
            value < config.thresholdLow || value > config.thresholdHigh,
        });
      }
    }
    return results;
  }
}
