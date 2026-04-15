export default function ThresholdBadge() {
  const low = -0.5, high = 0.8;
  return (
    <div className="bg-amber-500/10 border border-amber-400/50 text-amber-100 px-3 py-1 rounded-full text-sm">
      Alert if r {'<'} {low} or r {'>'} {high}
    </div>
  );
}
