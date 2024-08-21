import "@radix-ui/themes/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Theme } from "@radix-ui/themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TuneTrees",
  description:
    "TuneTrees is an app make music repertoire practice more efficient, and the tunes better retained in long term memory.",
};

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Theme>
            <div className="flex flex-col justify-between w-full h-full min-h-screen">
              <Header />
              <main className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0">
                {children}
              </main>
              <Footer />
            </div>
          </Theme>
        </ThemeProvider>{" "}
      </body>
    </html>
  );
}

// import "./globals.css"
// import { Lato } from "next/font/google"
// import type { Metadata } from "next"
// import Footer from "@/components/footer"
// import Header from "@/components/header"

// const lato = Lato({
//   weight: '400',
//   style: ['normal', 'italic'],
//   subsets: ['latin'],
//   display: 'swap',
// })

// // export default function RootLayout({
// //   children,
// // }: {
// //   children: React.ReactNode
// // }) {
// //   return (
// //     <html lang="en" className={lato.className}>
// //       <body>{children}</body>
// //     </html>
// //   )
// // }

// export const metadata: Metadata = {
//   title: "TuneTrees",
//   description:
//     "TuneTrees is an app make music repertoire practice more efficient, and the tunes better retained in long term memory.",
// }

// export default function RootLayout({ children }: React.PropsWithChildren) {
//   return (
//     <html lang="en">
//       <body className={lato.className}>
//         <div className="flex flex-col justify-between w-full h-full min-h-screen">
//           <Header />
//           <main className="flex-auto w-full max-w-3xl px-4 py-4 mx-auto sm:px-6 md:py-6">
//             {children}
//           </main>
//           <Footer />
//         </div>
//       </body>
//     </html>
//   )
// }
