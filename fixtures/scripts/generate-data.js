const fs = require("fs");
const path = require("path")


const config = {
    customers: 5000,
    transactions: 100000,
    alerts : 50000,
    devicesPerCustomer: 2,
    cardsForCustomer: 2
}

const MERCHANTS = [
    'ABC Mart', 'QuickCab', 'FoodWorld', 'TechStore', 'Global Retail',
    'Metro Travel', 'Online Market', 'SuperShop', 'Luxury Brands', 'Local Store'
];


const MCC_CODES = {
    '5411': 'Grocery Stores',
    '4121': 'Taxi/Limousine',
    '5732': 'Electronics',
    '4511': 'Airlines',
    '5812': 'Restaurants',
    '5921': 'Package Stores',
    '5541': 'Service Stations',
    '7299': 'Personal Services'
  };
  
  const CITIES = ['New York', 'London', 'Mumbai', 'Singapore', 'Tokyo', 'Sydney'];
  const COUNTRIES = ['US', 'GB', 'IN', 'SG', 'JP', 'AU'];

  function generateCustomers(count) {
    const customers = [];
    for (let i = 1; i <= count; i++) {
      customers.push({
        id: i,
        name: `Customer ${i}`,
        email_masked: `cust${i}@example.com`.replace(/(?<=cust\d{1,3})[^@]+/, '***'),
        kyc_level: ['BASIC', 'ENHANCED', 'ADVANCED'][Math.floor(Math.random() * 3)],
        created_at: randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31))
      });
    }
    return customers;
  }

  function generateCards(customers) {
    const cards = [];
    let cardId = 1;
    
    customers.forEach(customer => {
      const cardCount = Math.floor(Math.random() * 2) + 1; // 1-2 cards
      for (let i = 0; i < cardCount; i++) {
        cards.push({
          id: cardId++,
          customer_id: customer.id,
          last4: Math.floor(1000 + Math.random() * 9000).toString(),
          network: ['VISA', 'MASTERCARD', 'AMEX'][Math.floor(Math.random() * 3)],
          status: ['ACTIVE', 'INACTIVE', 'FROZEN'][Math.floor(Math.random() * 3)],
          created_at: randomDate(new Date(customer.created_at), new Date())
        });
      }
    });
    return cards;
  } 
  
  function generateAccounts(customers) {
    return customers.map(customer => ({
      id: customer.id,
      customer_id: customer.id,
      balance_cents: Math.floor(Math.random() * 1000000), // $0-$10,000
      currency: 'USD'
    }));
  }

  function generateDevices(customers) {
    const devices = [];
    let deviceId = 1;
    
    customers.forEach(customer => {
      const deviceCount = Math.floor(Math.random() * 3) + 1; // 1-3 devices
      for (let i = 0; i < deviceCount; i++) {
        devices.push({
          id: deviceId++,
          customer_id: customer.id,
          device_type: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)],
          os: ['iOS', 'Android', 'Windows', 'macOS'][Math.floor(Math.random() * 3)],
          last_seen: randomDate(new Date(2024, 0, 1), new Date())
        });
      }
    });
    return devices;
  }

  function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  // Generate all data

  console.log("Generating Seed Data")

  const customers = generateCustomers(config.customers)
  const cards = generateCards()
  const accounts = generateAccounts()
  const devices = generateDevices()

  // Save Files

  fs.writeFileSync(path.join(__dirname, "../customers.json", JSON.stringify(customers, null, 2)));
  fs.writeFileSync(path.join(__dirname, "../cards.json", JSON.stringify(cards, null, 2)));
  fs.writeFileSync(path.join(__dirname, "../accounts.json", JSON.stringify(accounts, null, 2)));
  fs.writeFileSync(path.join(__dirname, "../devices.json", JSON.stringify(devices, null, 2)));





