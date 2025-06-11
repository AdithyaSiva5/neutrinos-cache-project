# Neutrinos Config Dashboard

A proof-of-concept (PoC) for the **Neutrinos Bounty Challenge** that implements **smart cache invalidation for JSON tree configurations** in a multi-tenant architecture. The project features real-time updates, interactive visualizations, and a modern UI, with a focus on scalability and usability.

## 📖 Overview

The Neutrinos Config Dashboard is a full-stack application designed to manage JSON-based configuration trees for multiple tenants. It provides:

- **Node-level cache invalidation**: Efficiently invalidates cached nodes and their dependencies using Redis.
- **Real-time updates**: Leverages Socket.IO for instant notifications of configuration changes.
- **Interactive visualizations**: Displays configuration trees with D3.js and cache metrics with Chart.js.
- **Multi-tenant support**: Isolates configurations by tenant and config ID.
- **Modern UI**: Built with Next.js, Tailwind CSS, and glassmorphism design, including dark mode support.

### Key Features
- **Configuration Management**: Update and view JSON tree configurations with a user-friendly interface.
- **Cache Management**: Cache nodes in Redis with TTL, track dependencies, and invalidate nodes efficiently.
- **Real-time Notifications**: Receive instant updates via Socket.IO when nodes are invalidated.
- **Visualizations**:
  - **Tree View**: Interactive D3.js visualization of the JSON configuration tree.
  - **Metrics Dashboard**: Bar, line, and doughnut charts showing cache performance metrics.
  - **Event Log**: Real-time log of cache invalidation events.
- **Rate Limiting**: Protects the backend from abuse using tenant-based rate limiting.

## 🛠 Tech Stack
- **Frontend**:
  - Next.js 15 (React framework)
  - D3.js (tree visualization)
  - Chart.js (metrics visualization)
  - Socket.IO Client (real-time updates)
  - Tailwind CSS (styling)
  - React Toastify (notifications)
- **Backend**:
  - Express.js (API server)
  - PostgreSQL (persistent storage)
  - Redis (caching and metadata)
  - Socket.IO (real-time communication)
- **Testing**:
  - Jest (backend unit tests)
  - Supertest (API testing)

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 12
- Redis >= 6
- npm or yarn

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/adithyasiva5/neutrinos-config-dashboard.git
   cd neutrinos-config-dashboard