import "./globals.css";
export const metadata = {
  title: "GIMOON — Smart Links",
  description: "앨범 주소 하나로 국내외 음원 플랫폼을 연결하는 스마트 링크",
};
export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
