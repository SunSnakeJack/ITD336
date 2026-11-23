import './PublicPageHeading.css'

export function PublicPageHeading({ title, description }: { title: string; description?: string }) {
  return <header className="public-page-heading">
    <h1>{title}</h1>
    {description && <p>{description}</p>}
  </header>
}
