import { PriceRepository } from "../repositories/priceRepository";
import { config } from "../config";

export class PriceService {
  constructor(private repo: PriceRepository) { }

  async ingest(symbol: string, price: number) { await this.repo.push(symbol, price); }
  async latest(symbol: string) { return await this.repo.getLatest(symbol); }
  async history(symbol: string) { return await this.repo.getHistory(symbol); }
  async historyLast(symbol: string, limit: number) { return await this.repo.getHistoryLast(symbol, limit); }
  symbols() { return config.symbols; }
}
