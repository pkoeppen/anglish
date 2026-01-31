import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const match = context.url.pathname.match(/^\/letter\/([A-Z])$/);
  if (match) {
    return context.redirect(`/letter/${match[1].toLowerCase()}`, 301);
  }
  return next();
});
