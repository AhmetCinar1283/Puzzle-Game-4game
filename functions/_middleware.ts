export async function onRequest(context: { request: Request; next: () => Promise<Response> }) {
  const { request } = context;
  const url = new URL(request.url);

  if (url.hostname === 'game.polyvoclub.com') {
    url.hostname = 'syncron.polyvoclub.com';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
