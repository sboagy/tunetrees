import { Josefin_Sans, Lato } from "next/font/google"

const lato = Lato({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
})

export const josefinSans = Josefin_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={lato.className}>
      <body>{children}</body>
    </html>
  )
}
