# Kim's Chocolate - Packing Materials Management System

A modern, offline-first Progressive Web App (PWA) for managing chocolate packaging materials intake and purchasing operations at Kim's Chocolate factory in Tienen, Belgium.

## Overview

This application transforms traditional kringwinkel (second-hand store) operations into a specialized packing materials management system for a Belgian chocolate manufacturer. It handles the complete purchasing lifecycle from quote requests through order completion, with offline capabilities and real-time synchronization.

## Features

### Core Functionality
- **Packing Materials Inventory**: Track 50+ types of chocolate packaging materials including containers, sealing materials, labels, protection, and transport supplies
- **Purchase Workflow**: 9-step purchasing process (Quote Requested → Order Complete) with status tracking
- **Offline Operation**: Full CRUD operations work offline with automatic sync when connectivity returns
- **Photo Capture**: Integrated camera for documenting materials and damage
- **Real-time Analytics**: Dashboard with purchase status, supplier performance, and inventory insights

### Technical Features
- **Progressive Web App**: Installable on mobile devices with native app-like experience
- **Chocolate Theme**: Custom brown/white/black color palette with dark mode toggle
- **Responsive Design**: Optimized for desktop, tablet, and mobile use
- **TypeScript**: Full type safety throughout the application
- **Service Worker**: Background sync and caching for offline functionality

### Industry-Specific Data
- **Authentic Materials**: 50+ real packing materials used in Belgian chocolate production
- **European Suppliers**: Integration with major packaging suppliers (Amcor, Smurfit Kappa, Mondi, etc.)
- **Compliance Ready**: Designed to meet EU food contact material regulations (PPWR)
- **Belgian Localization**: Euro pricing, Dutch language support, Belgian business standards

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom chocolate theme
- **State Management**: React hooks with localStorage persistence
- **Testing**: Vitest with 29 comprehensive tests
- **Build**: Turbopack for fast development
- **PWA**: Service worker with offline capabilities

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kringwinkel-tienen
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # REST API routes
│   ├── globals.css        # Global styles with chocolate theme
│   ├── layout.tsx         # Root layout with theme provider
│   ├── manifest.ts        # PWA manifest
│   └── page.tsx           # Main application logic
├── components/            # Reusable UI components
├── lib/                   # Business logic and utilities
│   ├── demoItems.ts       # Packing materials data generation
│   ├── itemAudit.ts       # Audit trail functionality
│   ├── itemNormalize.ts   # Data validation and processing
│   └── types.ts           # TypeScript type definitions
├── tests/                 # Test files (29 tests)
└── public/                # Static assets
```

## Purchase Workflow

The application implements a comprehensive 9-step purchasing process:

1. **Quote Requested** - Initial supplier inquiry
2. **Awaiting Proforma** - Waiting for supplier quote
3. **Proforma Approved** - Internal approval received
4. **Order Placed** - Purchase order submitted
5. **In Transit** - Materials in shipping
6. **Delivered** - Materials received at warehouse
7. **Invoice Received** - Billing documentation arrived
8. **Invoice Paid** - Payment processed
9. **Order Complete** - Transaction finalized

## Demo Data

The application includes 50 authentic packing materials used in chocolate production:

- **Containers**: Gift boxes, tins, window boxes in various sizes
- **Sealing**: Foil, wrap, tape, glue, wax for food-safe packaging
- **Labels**: Ingredient, branding, date, and security labels
- **Protection**: Bubble wrap, foam, padding, corner protectors
- **Transport**: Shipping boxes, strapping, pallet wrap

All materials include realistic pricing (€0.50-€25), Belgian/European suppliers, and compliance specifications.

## Development Roadmap

- MVP and scale checklist: [docs/mvp-roadmap.md](docs/mvp-roadmap.md)
- Release strategy (PWA-first): [docs/release-strategy.md](docs/release-strategy.md)
- Store/release checklist: [docs/store-release-checklist.md](docs/store-release-checklist.md)

## Mobile Testing

Test the PWA on mobile devices:

1. Deploy to HTTPS (Vercel recommended)
2. Open in Safari (iOS) or Chrome (Android)
3. Tap Share → Add to Home Screen
4. Launch from home screen for native experience

## Contributing

1. Follow TypeScript strict mode
2. Add tests for new features
3. Update documentation
4. Ensure all CI checks pass

## License

This project is part of Kim's Chocolate operations in Tienen, Belgium.

Without these environment variables, the app falls back to local runtime storage, which is not reliable across serverless instances.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
