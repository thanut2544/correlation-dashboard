import { CorrelationService } from "../services/correlationService";
import { StreamService } from "../services/streamService";
import { config } from "../config";

export function startCorrelationJob(corr: CorrelationService, stream: StreamService) {
  const run = async () => {
    try {
      const results = await corr.compute();
      stream.sendCorrelation(results);
    } catch (err) {
      console.error("[correlationJob] Error computing correlations:", err);
    }
  };
  
  run();
  return setInterval(run, config.correlationIntervalMs);
}
