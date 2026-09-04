// Project data
const projects = [
  {
    id: 0,
    title: "Jardin Algorithmique",
    category: "ethereum",
    l2: "Base",
    imageUrl: "images/projects/jardin-algorithmique.webp",
    description: "Jardin Algorithmique is a generative art collection of 200 unique, curated pieces that blend nature and code. Using mathematical symmetry groups p6m and p31m, the same patterns found in honeycombs, snowflakes,.. The algorithm creates organic-inspired compositions through pure mathematics. Each piece emerges from the intersection of natural symmetry and computational precision, resulting in a plethora of different patterns.",
    features: [
      "200 unique curated outputs from generative algorithm",
      "Uses p6m and p31 symmetry groups for natural patterns",
      "Minted on Base L2 for low gas fees",
      "Interactive gallery to explore all variations",
      "Randomized minting experience",
      "Available on Highlight.xyz"
    ],
    conclusion: "Jardin Algorithmique represents the harmony between mathematical precision and organic beauty.",
    link: "https://akiraishi.com/Jardin-Algorithmique"
  },
  {
    id: 1,
    title: "Technosignatures",
    category: "bitcoin",
    onchain: "On-chain",
    imageUrl: "images/projects/Technosignatures2.webp",
    description: "Technosignatures is a retro SCI-FI generative art project inscribed on the Bitcoin blockchain. Through the power of the human mind and the blockchain, users can interact with the algorithm to take their own snapshot of outer Space, uncovering alien structures far across the Universe. The project features 15 discovered subject types grouped into 4 main factions, with 5 more waiting to be found by pioneers. Emotions might even influence the output, and special satoshis like Black, Vintage, or Palindrome can unlock unique visual effects.",
    features: [
      "Generative algorithm creating unique alien structures",
      "Interactive minting experience",
      "15+ subject types across 4 factions",
      "Special satoshi traits (Black, Vintage, Palindrome)",
      "3D Viewer for immersive exploration",
      "Parent-child provenance on Block9x450 Sat"
    ],
    conclusion: "A collaborative project with Völker, Technosignatures represents a journey into the unknown, exploring and discovering the Universe's wonders through blockchain technology.",
    link: "https://technosignatures.xyz/"
  },
  {
    id: 2,
    title: "Connecting",
    category: "bitcoin",
    onchain: "On-chain",
    imageUrl: "images/projects/connecting.gif",
    description: "\"Connecting\" is an interactive living system, breathing to the pulse of the Bitcoin blockchain. Each particle an entity, each link a connection. Multiple functionalities are available: interactivity, lens to zoom into the system, possibility to change and lock fonts (only inscribed fonts are used), as well as being able to manually change the activity to see different stages.",
    features: [
      "Two-piece algorithm: Ordinals version uses time between blocks and network busyness",
      "Real-time data version at akiraishi.com reacts directly to chain activity",
      "Recognizes spikes in activity and network congestion",
      "Influences gravity, particle speed, link count, and halo colors",
      "Resets and refreshes with every new block",
      "Interactive controls and zoom lens functionality"
    ],
    conclusion: "Connecting bridges art and blockchain in real-time, creating a visual representation of Bitcoin's heartbeat. The live data algorithm is available to everyone until mint completion, then exclusively to holders.",
    link: "https://akiraishi.com/Connecting.html"
  },
  {
    id: 11,
    title: "Comics Extracts",
    category: "tezos",
    chain: "Polkadot",
    imageUrl: "images/projects/comicsthumbnailc.png",
    description: "Comics Extracts is a visual project that translates the emotional language of comic books into generative art. Inspired by classic comic tropes and displays of emotion (impact, tension, surprise, chaos,..) the project deconstructs familiar visual storytelling devices into dynamic compositions of shape, rhythm, and motion. Rather than illustrating characters or scenes directly, it captures the feeling behind them and rebuilds those emotions as abstract storytelling systems.",
    features: [
      "Generative art minted on Polkadot",
      "Emotional vocabulary of comics distilled into pure form",
      "Impact, tension, surprise and chaos as generative parameters",
      "Panels, speed lines and onomatopoeia deconstructed into rhythm and motion",
      "No characters, no scenes, only the feeling they leave behind"
    ],
    conclusion: "Comics Extracts strips the page down to its raw emotional machinery, proving that a panel can still shout, tremble or explode long after the characters have left it.",
    link: "https://www.chaotic.art/ahp/drops/comics"
  },
  {
    id: 3,
    title: "Navigating the Trenches",
    category: "bitcoin",
    onchain: "On-chain",
    imageUrl: "images/projects/navigating.gif",
    description: "It's tough. Navigating the Trenches is a conceptual project that uses a few sub-4k inscriptions recursively and aims to depict the Crypto market with a simple animated chart. The piece reflects on human nature in volatile markets, how crowds rejoice and cheer when everything is working out, but quickly give up when things go down.",
    features: [
      "Recursive inscription using sub-4k inscriptions",
      "Animated chart depicting market cycles",
      "Conceptual commentary on market psychology",
      "Minimalist yet powerful visual narrative",
      "Permanently inscribed on Bitcoin"
    ],
    conclusion: "The true test of conviction isn't celebrating the highs, it's persevering through the lows. Those who navigate the trenches with resilience, continuing to build and believe when others abandon ship, are the ones who ultimately succeed. This piece serves as a reminder that the path to success is rarely a straight line upward.",
    link: "https://ordinals.com/inscription/navigating-the-trenches"
  },
  {
    id: 4,
    title: "Four Seasons",
    category: "bitcoin",
    onchain: "On-chain",
    imageUrl: "images/projects/4seasons_AkiraIshi75.gif",
    description: "Four Seasons is the first collection Akira inscribed on Ordinals,an innovative digital art collection that captures the essence of nature's cyclical and endless beauty through the lens of blockchain technology. Each piece presents an abstract interpretation of Spring, Summer, Autumn, and Winter through minimal shapes and deliberate color palettes. The collection explores not just the beauty of nature, but our deeply layered relationship with it. Crafted with code, rendered in abstraction, and preserved immutably on-chain.",
    features: [
      "Unique ordinals inscriptions on Bitcoin",
      "Four distinct seasonal themes with their own identities",
      "Minimal shapes with deliberate color palettes",
      "Permanent on-chain storage",
      "Inspired by Truchet tiles and Bauhaus aesthetics",
    ],
    conclusion: "Four Seasons stands as a defining piece in Akira's journey, a fusion of traditional artistic themes with blockchain technology, exploring our complex relationship with Nature and Technology.",
    link: "https://gamma.io/ordinals/collections/four-seasons/items"
  },
  {
    id: 5,
    title: "Googly Rocks",
    category: "ethereum",
    l2: "Base",
    imageUrl: "images/projects/googly.webp",
    description: "Googly Rocks is a playful and whimsical NFT project on Base L2 that brings personality to the blockchain. The project features an interactive website, a dedicated Twitter community, and extends into the audio realm with music releases on Zora and Bueno. It's a celebration of fun, creativity, and the lighter side of Web3 art.",
    features: [
      "Minted on Base L2 (Ethereum) for low fees",
      "Interactive website at googlyrocks.com",
      "Twitter community @googlyrocks",
      "Music releases",
      "Googly history coming soon",
      "Playful, community-driven project"
    ],
    conclusion: "Googly Rocks proves that NFT art doesn't always have to be only serious, sometimes the best creations are the ones that make you smile.",
    link: "https://googlyrocks.com/"
  },
  {
    id: 6,
    title: "Aodach",
    category: "ethereum",
    l2: "Arbitrum",
    imageUrl: "images/projects/aodach-1.webp",
    description: "Aodach is a generative art collection on Arbitrum L2, created in the wake of the artist’s grandmother’s passing. Deeply influenced by Celtic roots and heritage, the project explores digital patterns as a form of memory, symbolism, and continuity. Each piece reflects an algorithmic interpretation of ancestral motifs, transforming code into a living tribute anchored on the blockchain.",
    features: [
      "Minted on Arbitrum L2 (Ethereum) for low gas fees",      
      "Generative exploration of Celtic-inspired patterns and symbolism",
      "Deeply personal narrative rooted in memory and heritage",
      "Split across two OpenSea collections after platform shutdown",
    ],
    conclusion: "Aodach is a tribute to lineage and loss, merging generative art with Celtic heritage to create timeless digital artifacts preserved permanently on the blockchain.",
    link: "https://opensea.io/collection/aodach-akira-ishi"
  },
  {
    id: 7,
    title: "Art on Solana",
    category: "tezos",
    chain: "Solana",
    status: "Suspended",
    imageUrl: "images/projects/solana.webp",
    description: "A curated collection of Akira Ishi's artwork available on Exchange Art, exploring the visual tension between structure and perception. These pieces focus on Moiré patterns and optical illusions, where layered geometries and fine line interactions generate shifting, almost hypnotic effects. Each work invites the viewer into a dynamic experience, where movement and distortion emerge from static code.",
    features: [
    "Available on Exchange Art marketplace",
    "Exploration of Moiré patterns",
    "Use of optical illusions to create perceived motion and depth",
    "Curated selection of works"
  ],
  conclusion: "This collection investigates how algorithmic structures can manipulate perception, using Moiré and optical phenomena to transform simple forms into immersive visual experiences.",
  link: "https://exchange.art/akira-ishi/nfts"
  },
  {
    id: 8,
    title: "Songe d'un soir",
    category: "ethereum",
    imageUrl: "images/projects/songe.webp",
    description: "Songe d'un soir (Dream of an Evening) is a deeply personal generative art piece created during a dark period, yet born from an unwavering love for generative art. The work is accompanied by a bilingual poem that captures the essence of dreams, reality, and the fear of loss. It represents the artist's resilience and the healing power of creative expression.",
    features: [
      "Generative art on Ethereum (fxhash)",
      "Accompanied by original bilingual poem",
      "Explores themes of dreams and reality",
      "Personal and emotional narrative",
      "Created through adversity",
      "Testament to the healing power of art"
    ],
    conclusion: "Songe d'un soir, aventure embrumée / Dream of an eve, a misty adventure... Ces songes sont en réalité mes cauchemars / De ne jamais plus pouvoir vous voir.",
    link: "https://www.fxhash.xyz/project/songe-d'un-soir"
  },
  {
    id: 9,
    title: "What's the point.",
    category: "tezos",
    imageUrl: "images/projects/whatsthepoint.webp",
    description: "The foundational project that started it all. Built entirely with ellipses as a self-imposed constraint, this 'build your art' experience lets you appreciate intricate details when zooming into the piece you've helped create. More than just art, it's accompanied by a pivotal Medium article that explores the philosophy of constraint-based creating, proving that limitations don't restrict creativity, they focus it. This project and its article laid the groundwork for everything that followed.",
    features: [
      "Read the article for a better understanding of how to use the algorithm",
      "Built entirely with ellipses (constraint-based)",
      "Minted on Tezos via fxhash",
      "Foundational Medium article on constraint-based philosophy",
      "Interactive 'build your art' experience",
      "The starting point of a cohesive artistic journey"
    ],
    conclusion: "What's the point? The point is that constraints don't limit creativity—they focus it. Read the accompanying article to understand the philosophy that drives all future creations.",
    link: "https://www.fxhash.xyz/project/what's-the-point.",
    articleLink: "https://medium.com/@leAkira_Ishi/whats-the-point-921ff4c86eed"
  },
  {
    id: 10,
    title: "Tezos Curated Works",
    category: "tezos",
    imageUrl: "images/projects/meeting in the middle.webp",
    description: "A collection of curated outputs from What's the point and other creations on the Tezos blockchain. These pieces showcase the full capabilities of constraint-based generative art, demonstrating how simple rules can produce infinitely complex and beautiful results. Each piece is carefully selected to represent the best of what the algorithms can achieve.",
    features: [
      "Curated outputs from generative algorithms",
      "Showcases constraint-based art capabilities",
      "Available on Tezos blockchain",
      "Hand-selected best results",
      "Demonstrates algorithmic potential",
      "Energy-efficient Tezos network"
    ],
    conclusion: "These curated works shows us what emerges when code meets creativity under carefully chosen constraints.",
    link: "https://www.fxhash.xyz/u/Akira%20Ishi"
  }
];
