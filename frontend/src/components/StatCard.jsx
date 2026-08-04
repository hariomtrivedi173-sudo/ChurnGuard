function StatCard({ label, value, color = 'purple' }) {
  const colors = {
    purple: 'bg-purple-100 text-purple-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
  }

  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

export default StatCard