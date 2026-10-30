import { useEffect, useState } from 'react'
import { fetchPrivateFileUrl } from '../lib/api'

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fileUrl: string
}

export default function AuthenticatedImage({ fileUrl, onClick, ...props }: AuthenticatedImageProps) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    fetchPrivateFileUrl(fileUrl)
      .then((url) => { objectUrl = url; if (active) setSrc(url) })
      .catch(() => { if (active) setSrc(undefined) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [fileUrl])
  return <img {...props} src={src} onClick={onClick} />
}
