import { MDXProvider } from "@mdx-js/react";
import { BrowserRouter, Route, Routes } from "react-router";
import { mdxComponents } from "./components/mdxComponents";
import { ScrollToTop } from "./components/ScrollToTop";
import { Home } from "./pages/Home";
import { Chapter } from "./pages/Chapter";
import { NotFound } from "./pages/NotFound";

// AppRoutes is the routing tree without the router or the MDX provider, so tests can
// mount it under a MemoryRouter. App wires the real BrowserRouter and MDXProvider.
export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:slug" element={<Chapter />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <MDXProvider components={mdxComponents}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MDXProvider>
  );
}
