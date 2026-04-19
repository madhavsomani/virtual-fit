import { NextRequest, NextResponse } from "next/server";

// Mock Stripe checkout session creation
// In production, this would create a real Stripe Checkout session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, email } = body;

    // Validate plan
    const validPlans = ["creator", "retailer"];
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    // Mock pricing
    const prices: Record<string, { amount: number; name: string }> = {
      creator: { amount: 900, name: "Creator Plan" },
      retailer: { amount: 4900, name: "Retailer Plan" },
    };

    const selectedPrice = prices[plan];

    // In test mode, we'll return a mock session that redirects to success
    // In production, this would be:
    // const session = await stripe.checkout.sessions.create({...})
    
    const mockSessionId = `cs_test_${Date.now()}_${plan}`;
    
    // Log for debugging (in production, save to database)
    console.log(`[Checkout] Plan: ${plan}, Email: ${email}, Session: ${mockSessionId}`);

    // Return mock checkout URL
    // In test mode, redirect to success page directly
    const successUrl = `${request.nextUrl.origin}/checkout/success?session_id=${mockSessionId}&plan=${plan}`;
    
    return NextResponse.json({
      sessionId: mockSessionId,
      url: successUrl,
      plan: selectedPrice.name,
      amount: selectedPrice.amount,
      mode: "test",
    });
  } catch (error) {
    console.error("[Checkout Error]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
