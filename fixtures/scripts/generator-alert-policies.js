const fs = require('fs');
const path = require('path');

// Generate alerts based on transaction patterns
function generateAlerts(transactions, count = 50000) {
  const alerts = [];
  const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
  const statuses = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'];
  
  // Sample transactions for alerts (high amount, unusual locations, etc.)
  const suspectTransactions = transactions
    .filter(t => 
      t.amount_cents > 100000 || // Over $1000
      Math.random() < 0.01 // 1% random sampling
    )
    .slice(0, count);
  
  return suspectTransactions.map((txn, index) => {
    const ts = new Date(txn.ts); // ensure Date object
    return ({
      id: index + 1,
      customer_id: txn.customer_id,
      suspect_txn_id: txn.id,
      created_at: new Date(ts.getTime() + Math.random() * 86400000), // Within 1 day of transaction
      risk: riskLevels[Math.floor(Math.random() * riskLevels.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)]
    });
  });
}

// Knowledge Base Documents
const kbDocs = [
  {
    id: 1,
    title: "Dispute Process Guide",
    anchor: "dispute-process",
    content_text: "Customers have 60 days from transaction date to file a dispute. Requires transaction details and reason code."
  },
  {
    id: 2,
    title: "Card Freeze Policy",
    anchor: "card-freeze",
    content_text: "Cards can be frozen temporarily for suspected fraud. OTP verification required for high-risk freezes."
  },
  {
    id: 3,
    title: "Risk Assessment Criteria",
    anchor: "risk-criteria",
    content_text: "Risk scores consider transaction velocity, location changes, merchant risk, and historical patterns."
  }
];

// Policies
const policies = [
  {
    id: 1,
    code: "OTP_REQUIRED",
    title: "OTP Verification Required",
    content_text: "For transactions over $500 or foreign transactions, OTP verification is mandatory."
  },
  {
    id: 2,
    code: "FREEZE_LIMIT",
    title: "Card Freeze Limits",
    content_text: "Maximum 3 card freezes per customer per month. Lead approval required for additional freezes."
  },
  {
    id: 3,
    code: "DISPUTE_AMOUNT",
    title: "Dispute Amount Thresholds",
    content_text: "Disputes over $5000 require additional documentation and lead approval."
  }
];

// Generate the data
const transactions = require('../transactions.json');
const alerts = generateAlerts(transactions, 50000);

// Save files
fs.writeFileSync(path.join(__dirname, '../alerts.json'), JSON.stringify(alerts, null, 2));
fs.writeFileSync(path.join(__dirname, '../kb_docs.json'), JSON.stringify(kbDocs, null, 2));
fs.writeFileSync(path.join(__dirname, '../policies.json'), JSON.stringify(policies, null, 2));

console.log('Alerts and policies generated!');