export async function GET() {
  return Response.json({ status: "ready", service: "web" }, { status: 200 });
}
