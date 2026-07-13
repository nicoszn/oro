import { NextResponse } from 'next/server';
import { runSimulation } from '@/lib';

export async function GET() {
  console.log("start get")
  try {
    const result = await runSimulation();
    console.log(result)
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Simulation failed', details: String(error) },
      { status: 500 }
    );
  }
}
