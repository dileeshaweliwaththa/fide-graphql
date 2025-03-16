<div align="center">
  <h1>
    <img src="https://nestjs.com/img/logo-small.svg" width="30" alt="Nest Logo" />
    &nbsp;FIDE Chess GraphQL API&nbsp;
    <img src="https://raw.githubusercontent.com/graphql/graphql-spec/main/resources/GraphQL%20Logo.svg" width="30" alt="GraphQL Logo" />
  </h1>
  
  <p>
    ♔ ♕ ♖ ♗ ♘ ♙ &nbsp;&nbsp; A powerful GraphQL API for chess player data &nbsp;&nbsp; ♟ ♞ ♝ ♜ ♛ ♚
  </p>

  <p>
    <a href="https://github.com/dileeshaweliwaththa/fide-graphql/stargazers">
      <img alt="GitHub stars" src="https://img.shields.io/github/stars/dileeshaweliwaththa/fide-graphql?style=for-the-badge&color=ffcb2f&logo=starship&logoColor=ffcb2f">
    </a>
    <a href="https://github.com/dileeshaweliwaththa/fide-graphql/issues">
      <img alt="Issues" src="https://img.shields.io/github/issues/dileeshaweliwaththa/fide-graphql?style=for-the-badge&color=4e5255">
    </a>
    <a href="https://github.com/dileeshaweliwaththa/fide-graphql/blob/master/LICENSE">
      <img alt="GitHub license" src="https://img.shields.io/github/license/dileeshaweliwaththa/fide-graphql?style=for-the-badge&color=228B22">
    </a>
  </p>
</div>

## ✨ Features

- 🏆 **FIDE Player Data**: Access comprehensive chess player information
- 📊 **Rating History**: Track player rating changes over time
- 🌍 **Global Rankings**: World, continental and national rankings
- ⚡ **Fast & Efficient**: Built on NestJS with GraphQL for optimal performance

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 📋 GraphQL Queries

Access player data with clean, intuitive queries:

```graphql
query {
  playerInfo(fideId: "13413937", includeHistory: true) {
    fide_id
    name
    country
    birth_year
    title
    rating
    world_rank_all
    world_rank_active
    national_rank_all
    continental_rank_all
    national_rank_active
    continental_rank_active
    sex
  }
}

query {
  multiplePlayersInfo(
    fideIds: ["5000017", "5000056", "5000076"]

  ) {
players{
    fide_id
    name
    country
    birth_year
    title
    rating
    world_rank_all
    world_rank_active
    national_rank_all
    continental_rank_all
    national_rank_active
    continental_rank_active
    sex
}
  }
}
```

## 🧩 Data Models

The API provides rich data models including:

- **Player**: Complete player profile with rankings
- **Rating History**: Historical rating data points
- **Tournaments**: Competition results and statistics

## 🔧 Technologies

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [GraphQL](https://graphql.org/) - API query language
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
