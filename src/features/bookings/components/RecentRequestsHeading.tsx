import './RecentRequestsHeading.css'

export function RecentRequestsHeading({ count }: { count: number }) {
  return <header className="recent-requests-heading">
    <h2>รายการล่าสุด</h2>
    <span>{count} รายการ</span>
  </header>
}
