import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" lede="This part of HERA isn’t available yet." />
      <Link className="btn btn-primary" to="/">Back to overview</Link>
    </>
  )
}
