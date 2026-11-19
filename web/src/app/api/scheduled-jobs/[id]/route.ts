import { NextResponse } from "next/server";
import {
  deleteScheduledJob,
  patchScheduledJob,
  ScheduledJobValidationError,
} from "@/lib/scheduled-jobs";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await req.json();
    const job = await patchScheduledJob(id, body);
    return job
      ? NextResponse.json(job)
      : NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  } catch (error) {
    const status = error instanceof ScheduledJobValidationError || error instanceof SyntaxError ? 400 : error instanceof Error && /lock timeout/i.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível atualizar a busca agendada." : error instanceof Error ? error.message : "Atualização inválida" }, { status });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const job = await deleteScheduledJob(id);
    return job ? NextResponse.json(job) : NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  } catch (error) {
    const status = error instanceof Error && /lock timeout/i.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "As buscas agendadas estão ocupadas; tente novamente." : "Não foi possível excluir a busca agendada." }, { status });
  }
}
