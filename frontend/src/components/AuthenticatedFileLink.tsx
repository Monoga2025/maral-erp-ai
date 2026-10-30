import { useEffect, useState } from 'react'
import { fetchPrivateFileUrl } from '../lib/api'

export default function AuthenticatedFileLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [objectUrl, setObjectUrl] = useState<string>()
  useEffect(() => {
    if (!href) return
    let active = true
    let createdUrl: string | undefined
    fetchPrivateFileUrl(href)
      .then((url) => { createdUrl = url; if (active) setObjectUrl(url) })
      .catch(() => { if (active) setObjectUrl(undefined) })
    return () => { active = false; if (createdUrl) URL.revokeObjectURL(createdUrl) }
  }, [href])
  return <a {...props} href={objectUrl} download target={undefined} rel={undefined}>{children}</a>
}
