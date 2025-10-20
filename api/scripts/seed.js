/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function loadJson(relPath) {
  const p = path.join(__dirname, '..', relPath);
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw);
}

async function main() {
  console.log('Seeding database from fixtures...');

  const customers = loadJson('fixtures/customers.json');
  const cards = loadJson('fixtures/cards.json');
  const accounts = loadJson('fixtures/accounts.json');
  let transactions = [];
  try {
    transactions = loadJson('fixtures/transactions.json');
  } catch (e) {
    console.warn('transactions.json not found, skipping transactions seed.');
  }
  let alerts = [];
  let kbDocs = [];
  let policies = [];
  try {
    alerts = loadJson('fixtures/alerts.json');
  } catch {}
  try {
    kbDocs = loadJson('fixtures/kb_docs.json');
  } catch {}
  try {
    policies = loadJson('fixtures/policies.json');
  } catch {}

  // Customers
  console.log(`Upserting customers: ${customers.length}`);
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: String(c.id) },
      update: {
        name: c.name,
        email: c.email_masked,
        kycLevel: c.kyc_level,
        createdAt: new Date(c.created_at),
      },
      create: {
        id: String(c.id),
        name: c.name,
        email: c.email_masked,
        kycLevel: c.kyc_level,
        createdAt: new Date(c.created_at),
      },
    });
  }

  // Accounts
  console.log(`Upserting accounts: ${accounts.length}`);
  for (const a of accounts) {
    await prisma.account.upsert({
      where: { id: String(a.id) },
      update: {
        customerId: String(a.customer_id),
        balanceCents: a.balance_cents,
        currency: a.currency,
      },
      create: {
        id: String(a.id),
        customerId: String(a.customer_id),
        balanceCents: a.balance_cents,
        currency: a.currency,
      },
    });
  }

  // Cards
  console.log(`Upserting cards: ${cards.length}`);
  for (const card of cards) {
    await prisma.card.upsert({
      where: { id: String(card.id) },
      update: {
        customerId: String(card.customer_id),
        last4: card.last4,
        network: card.network,
        status: card.status,
        createdAt: new Date(card.created_at),
      },
      create: {
        id: String(card.id),
        customerId: String(card.customer_id),
        last4: card.last4,
        network: card.network,
        status: card.status,
        createdAt: new Date(card.created_at),
      },
    });
  }

  // Transactions (batch to avoid huge transaction)
  if (transactions.length) {
    console.log(`Upserting transactions: ${transactions.length}`);
    const batchSize = 5000;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((t) =>
          prisma.transaction.upsert({
            where: { id: String(t.id) },
            update: {
              customerId: String(t.customer_id),
              cardId: t.card_id ? String(t.card_id) : null,
              mcc: t.mcc,
              merchant: t.merchant,
              amountCents: t.amount_cents,
              currency: t.currency,
              ts: new Date(t.ts),
              deviceId: t.device_id ? String(t.device_id) : null,
              country: t.country || null,
              city: t.city || null,
            },
            create: {
              id: String(t.id),
              customerId: String(t.customer_id),
              cardId: t.card_id ? String(t.card_id) : null,
              mcc: t.mcc,
              merchant: t.merchant,
              amountCents: t.amount_cents,
              currency: t.currency,
              ts: new Date(t.ts),
              deviceId: t.device_id ? String(t.device_id) : null,
              country: t.country || null,
              city: t.city || null,
            },
          })
        )
      );
      if ((i / batchSize) % 10 === 0) console.log(`  ... ${Math.min(i + batchSize, transactions.length)} / ${transactions.length}`);
    }
  }

  // Alerts
  if (alerts.length) {
    console.log(`Upserting alerts: ${alerts.length}`);
    for (const a of alerts) {
      await prisma.alert.upsert({
        where: { id: String(a.id) },
        update: {
          customerId: String(a.customer_id),
          suspectTxnId: a.suspect_txn_id ? String(a.suspect_txn_id) : null,
          createdAt: new Date(a.created_at),
          risk: a.risk,
          status: a.status,
        },
        create: {
          id: String(a.id),
          customerId: String(a.customer_id),
          suspectTxnId: a.suspect_txn_id ? String(a.suspect_txn_id) : null,
          createdAt: new Date(a.created_at),
          risk: a.risk,
          status: a.status,
        },
      });
    }
  }

  // KB Docs
  if (kbDocs.length) {
    console.log(`Upserting KB docs: ${kbDocs.length}`);
    for (const d of kbDocs) {
      await prisma.kbDoc.upsert({
        where: { id: String(d.id) },
        update: { title: d.title, anchor: d.anchor, content: d.content_text },
        create: { id: String(d.id), title: d.title, anchor: d.anchor, content: d.content_text },
      });
    }
  }

  // Policies
  if (policies.length) {
    console.log(`Upserting policies: ${policies.length}`);
    for (const p of policies) {
      await prisma.policy.upsert({
        where: { id: String(p.id) },
        update: { code: p.code, title: p.title, content: p.content_text },
        create: { id: String(p.id), code: p.code, title: p.title, content: p.content_text },
      });
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
