import { useEffect } from "react";
import { useLocation } from "react-router";

// Reset the scroll position on every route change. Without this, moving to the next
// chapter lands the reader wherever the previous page happened to be scrolled to.
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
