const fs = require('fs');
const path = require('path');

class TransactionGenerator {
  constructor(customers, cards, targetCount = 1000000) {
    this.customers = customers;
    this.cards = cards;
    this.targetCount = targetCount;
    this.transactions = [];
  }

  generate() {
    console.log(`Generating ${this.targetCount.toLocaleString()} transactions...`);
    
    const batchSize = 100000;
    const batches = Math.ceil(this.targetCount / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchTransactions = [];
      const currentBatchSize = Math.min(batchSize, this.targetCount - (batch * batchSize));
      
      for (let i = 0; i < currentBatchSize; i++) {
        const customer = this.customers[Math.floor(Math.random() * this.customers.length)];
        const customerCards = this.cards.filter(c => c.customer_id === customer.id);
        const card = customerCards[Math.floor(Math.random() * customerCards.length)];
        
        if (!card) continue;

        const mccCodes = Object.keys(this.getMCCCodes());
        const mcc = mccCodes[Math.floor(Math.random() * mccCodes.length)];
        const amount = this.generateAmount(mcc);
        
        batchTransactions.push({
          id: (batch * batchSize) + i + 1,
          customer_id: customer.id,
          card_id: card.id,
          mcc: mcc,
          merchant: this.getMerchant(mcc),
          amount_cents: amount,
          currency: 'USD',
          ts: this.randomTransactionDate(customer.created_at),
          device_id: Math.floor(Math.random() * 3) + 1, // Simplified device assignment
          country: this.getCountry(),
          city: this.getCity()
        });
      }
      
      this.transactions.push(...batchTransactions);
      console.log(`Batch ${batch + 1}/${batches} complete: ${this.transactions.length.toLocaleString()} transactions`);
    }
    
    return this.transactions;
  }

  getMCCCodes() {
    return {
      '5411': 'Grocery Stores',
      '4121': 'Taxi/Limousine',
      '5732': 'Electronics',
      '4511': 'Airlines',
      '5812': 'Restaurants',
      '5921': 'Package Stores',
      '5541': 'Service Stations',
      '7299': 'Personal Services'
    };
  }

  generateAmount(mcc) {
    const ranges = {
      '5411': { min: 500, max: 25000 },    // Grocery: $5-$250
      '4121': { min: 1000, max: 10000 },   // Taxi: $10-$100
      '5732': { min: 5000, max: 500000 },  // Electronics: $50-$5000
      '4511': { min: 10000, max: 2000000 }, // Airlines: $100-$20,000
      '5812': { min: 1500, max: 50000 },   // Restaurants: $15-$500
      '5921': { min: 1000, max: 50000 },   // Package Stores: $10-$500
      '5541': { min: 2000, max: 15000 },   // Gas: $20-$150
      '7299': { min: 1000, max: 50000 }    // Services: $10-$500
    };
    
    const range = ranges[mcc] || { min: 100, max: 10000 };
    return Math.floor(range.min + Math.random() * (range.max - range.min));
  }

  getMerchant(mcc) {
    const merchantsByMCC = {
      '5411': ['SuperMarket', 'Grocery World', 'Fresh Mart'],
      '4121': ['QuickCab', 'CityRide', 'Metro Taxi'],
      '5732': ['TechStore', 'Electro World', 'Gadget Hub'],
      '4511': ['Sky Airlines', 'Global Travel', 'Metro Air'],
      '5812': ['Food Palace', 'Bistro Central', 'Cafe Express'],
      '5921': ['Liquor Store', 'Beverage World', 'Spirit Shop'],
      '5541': ['Gas Station', 'Fuel Stop', 'Energy Plus'],
      '7299': ['Spa Center', 'Fitness Pro', 'Beauty Salon']
    };
    
    const merchants = merchantsByMCC[mcc] || ['General Store', 'Retail Outlet'];
    return merchants[Math.floor(Math.random() * merchants.length)];
  }

  getCountry() {
    const countries = ['US', 'GB', 'IN', 'SG', 'JP', 'AU', 'CA', 'DE'];
    return countries[Math.floor(Math.random() * countries.length)];
  }

  getCity() {
    const cities = ['New York', 'London', 'Mumbai', 'Singapore', 'Tokyo', 'Sydney', 'Toronto', 'Berlin'];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  randomTransactionDate(customerSince) {
    const start = new Date(customerSince);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  saveToFile(filename) {
    fs.writeFileSync(filename, JSON.stringify(this.transactions, null, 2));
    console.log(`Saved ${this.transactions.length.toLocaleString()} transactions to ${filename}`);
  }
}

// Usage
const customers = require('../customers.json');
const cards = require('../cards.json');

const generator = new TransactionGenerator(customers, cards, 1000000); // 1M transactions
const transactions = generator.generate();
generator.saveToFile(path.join(__dirname, '../transactions.json'));