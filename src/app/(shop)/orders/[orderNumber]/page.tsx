import { OrderTracker } from "@/components/shop/order-tracker";

export default async function OrderTrackingPage({
  params,
}: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  return <OrderTracker orderNumber={orderNumber} />;
}
