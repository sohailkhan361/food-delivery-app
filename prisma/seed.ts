/**
 * Idempotent development seed — safe to re-run.
 *
 * Gives you enough to click through the app: two zones, three restaurants
 * with real menus, a customer with an address, staff logins, and a few
 * orders spread across the lifecycle so the dashboard queue is not empty.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { generateOrderNumber } from "../src/lib/orders/order-number";
import { computePricing } from "../src/lib/orders/pricing";

const db = new PrismaClient();

const R = (rupees: number) => Math.round(rupees * 100); // -> paise

async function main() {
  console.log("Seeding…");

  // ------------------------------------------------------------ zones
  const central = await db.zone.upsert({
    where: { city_name: { city: "Bengaluru", name: "Central" } },
    update: {},
    create: {
      name: "Central",
      city: "Bengaluru",
      postalCodes: ["560001", "560025", "560042"],
      deliveryFeeMinor: R(29),
      minOrderMinor: R(149),
      etaMinutes: 35,
    },
  });

  const north = await db.zone.upsert({
    where: { city_name: { city: "Bengaluru", name: "North" } },
    update: {},
    create: {
      name: "North",
      city: "Bengaluru",
      postalCodes: ["560045", "560080"],
      deliveryFeeMinor: R(49),
      minOrderMinor: R(199),
      etaMinutes: 45,
    },
  });

  // ------------------------------------------------------------ people
  const customer = await db.user.upsert({
    where: { phone: "+919000000001" },
    update: {},
    create: {
      phone: "+919000000001",
      name: "Asha Rao",
      email: "asha@example.com",
      role: "CUSTOMER",
    },
  });

  await db.address.deleteMany({ where: { userId: customer.id } });
  await db.address.create({
    data: {
      userId: customer.id,
      label: "Home",
      line1: "12, 4th Cross, Richmond Town",
      city: "Bengaluru",
      postalCode: "560025",
      zoneId: central.id,
      isDefault: true,
    },
  });

  const owner = await db.user.upsert({
    where: { phone: "+919000000002" },
    update: {},
    create: {
      phone: "+919000000002",
      name: "Imran Sheikh",
      role: "RESTAURANT_STAFF",
    },
  });

  await db.user.upsert({
    where: { phone: "+919000000003" },
    update: {},
    create: { phone: "+919000000003", name: "Ops Admin", role: "ADMIN" },
  });

  // ------------------------------------------------------------ restaurants
  const DEFINITIONS = [
    {
      slug: "tandoor-house",
      name: "Tandoor House",
      description: "North Indian curries, breads, and kebabs from a clay oven.",
      taxPercent: "5.00",
      packingFeeMinor: R(15),
      avgPrepMinutes: 30,
      zones: [central.id, north.id],
      categories: [
        {
          name: "Breads",
          items: [
            { name: "Butter Naan", priceMinor: R(60), isVeg: true },
            { name: "Garlic Kulcha", priceMinor: R(80), isVeg: true },
          ],
        },
        {
          name: "Mains",
          items: [
            {
              name: "Paneer Butter Masala",
              priceMinor: R(249),
              isVeg: true,
              description: "Cottage cheese in a tomato-cashew gravy.",
              optionGroups: [
                {
                  name: "Spice level",
                  selectionType: "SINGLE" as const,
                  minSelect: 1,
                  maxSelect: 1,
                  options: [
                    { name: "Mild", priceDeltaMinor: 0 },
                    { name: "Medium", priceDeltaMinor: 0 },
                    { name: "Hot", priceDeltaMinor: 0 },
                  ],
                },
                {
                  name: "Add-ons",
                  selectionType: "MULTIPLE" as const,
                  minSelect: 0,
                  maxSelect: 3,
                  options: [
                    { name: "Extra gravy", priceDeltaMinor: R(40) },
                    { name: "Extra paneer", priceDeltaMinor: R(70) },
                  ],
                },
              ],
            },
            { name: "Chicken Tikka Masala", priceMinor: R(329), isVeg: false },
          ],
        },
      ],
    },
    {
      slug: "dosa-corner",
      name: "Dosa Corner",
      description: "Crisp dosas and filter coffee, all day.",
      taxPercent: "5.00",
      packingFeeMinor: R(10),
      avgPrepMinutes: 20,
      zones: [central.id],
      categories: [
        {
          name: "Dosas",
          items: [
            { name: "Masala Dosa", priceMinor: R(120), isVeg: true },
            { name: "Ghee Roast", priceMinor: R(150), isVeg: true },
          ],
        },
        {
          name: "Drinks",
          items: [{ name: "Filter Coffee", priceMinor: R(50), isVeg: true }],
        },
      ],
    },
    {
      slug: "wok-and-roll",
      name: "Wok & Roll",
      description: "Indo-Chinese noodles and rice bowls.",
      taxPercent: "5.00",
      packingFeeMinor: R(20),
      avgPrepMinutes: 25,
      zones: [north.id],
      categories: [
        {
          name: "Noodles",
          items: [
            { name: "Hakka Noodles", priceMinor: R(199), isVeg: true },
            { name: "Chilli Chicken Noodles", priceMinor: R(259), isVeg: false },
          ],
        },
      ],
    },
  ];

  const restaurantIds: Record<string, string> = {};

  for (const def of DEFINITIONS) {
    const restaurant = await db.restaurant.upsert({
      where: { slug: def.slug },
      update: { isActive: true, isAcceptingOrders: true },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        phone: "+918000000000",
        line1: "1, Commercial Street",
        city: "Bengaluru",
        postalCode: "560001",
        isActive: true,
        isAcceptingOrders: true,
        packingFeeMinor: def.packingFeeMinor,
        taxPercent: def.taxPercent,
        commissionPercent: "18.00",
        avgPrepMinutes: def.avgPrepMinutes,
      },
    });
    restaurantIds[def.slug] = restaurant.id;

    // Rebuild the menu each run so edits to this file take effect.
    await db.menuCategory.deleteMany({ where: { restaurantId: restaurant.id } });

    for (const [ci, cat] of def.categories.entries()) {
      const category = await db.menuCategory.create({
        data: { restaurantId: restaurant.id, name: cat.name, sortOrder: ci },
      });

      for (const [ii, item] of cat.items.entries()) {
        await db.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: item.name,
            description: "description" in item ? item.description : undefined,
            priceMinor: item.priceMinor,
            isVeg: item.isVeg,
            sortOrder: ii,
            optionGroups: {
              create: ("optionGroups" in item ? item.optionGroups : [])?.map(
                (g, gi) => ({
                  name: g.name,
                  selectionType: g.selectionType,
                  minSelect: g.minSelect,
                  maxSelect: g.maxSelect,
                  sortOrder: gi,
                  options: {
                    create: g.options.map((o, oi) => ({
                      name: o.name,
                      priceDeltaMinor: o.priceDeltaMinor,
                      sortOrder: oi,
                    })),
                  },
                }),
              ),
            },
          },
        });
      }
    }

    await db.restaurantZone.deleteMany({ where: { restaurantId: restaurant.id } });
    await db.restaurantZone.createMany({
      data: def.zones.map((zoneId) => ({ restaurantId: restaurant.id, zoneId })),
    });

    // Open 11:00–23:00 daily; closed Mondays.
    await db.openingHours.deleteMany({ where: { restaurantId: restaurant.id } });
    await db.openingHours.createMany({
      data: Array.from({ length: 7 }, (_, day) => ({
        restaurantId: restaurant.id,
        dayOfWeek: day,
        opensAt: "11:00",
        closesAt: "23:00",
        isClosed: day === 1,
      })),
    });

    await db.restaurantStaff.upsert({
      where: { userId_restaurantId: { userId: owner.id, restaurantId: restaurant.id } },
      update: {},
      create: { userId: owner.id, restaurantId: restaurant.id, role: "OWNER" },
    });
  }

  // ------------------------------------------------------------ sample orders
  await db.order.deleteMany({ where: { customerId: customer.id } });

  const address = await db.address.findFirstOrThrow({
    where: { userId: customer.id },
  });

  const SAMPLES = [
    { slug: "tandoor-house", status: "PLACED" as const, itemName: "Paneer Butter Masala", unit: R(249), qty: 2 },
    { slug: "dosa-corner", status: "PREPARING" as const, itemName: "Masala Dosa", unit: R(120), qty: 3 },
    { slug: "wok-and-roll", status: "DELIVERED" as const, itemName: "Hakka Noodles", unit: R(199), qty: 1 },
  ];

  for (const sample of SAMPLES) {
    const restaurantId = restaurantIds[sample.slug];
    const restaurant = await db.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    });

    // Same pricing function the API uses — the seed cannot drift from prod.
    const breakdown = computePricing(
      [{ unitPriceMinor: sample.unit, quantity: sample.qty }],
      {
        orderType: "DELIVERY",
        packingFeeMinor: restaurant.packingFeeMinor,
        taxPercent: restaurant.taxPercent.toString(),
        zone: { deliveryFeeMinor: central.deliveryFeeMinor, minOrderMinor: central.minOrderMinor },
      },
    );

    await db.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        idempotencyKey: crypto.randomUUID(),
        customerId: customer.id,
        restaurantId,
        addressId: address.id,
        type: "DELIVERY",
        status: sample.status,
        contactPhone: customer.phone,
        ...breakdown,
        addressSnapshot: {
          line1: address.line1,
          city: address.city,
          postalCode: address.postalCode,
        },
        items: {
          create: {
            nameSnapshot: sample.itemName,
            unitPriceMinor: sample.unit,
            quantity: sample.qty,
            lineTotalMinor: sample.unit * sample.qty,
          },
        },
        events: {
          create: { status: sample.status, actorRole: "CUSTOMER", actorId: customer.id },
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log("  customer  +919000000001");
  console.log("  merchant  +919000000002");
  console.log("  admin     +919000000003");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
