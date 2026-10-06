// The page's one main landmark, so a screen reader can jump straight to the content.
export default function MainLandmarkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main>{children}</main>;
}
