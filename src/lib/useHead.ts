import { useEffect } from "react";

// useHead --- set the document title and meta description per route, with no deps.
// The registry gives every route a real title instead of the one static tab title.
export function useHead(title: string, description?: string): void {
  useEffect(() => {
    document.title = title;
    if (description !== undefined) {
      let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}
