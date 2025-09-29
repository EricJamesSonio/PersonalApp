PersonalApp/
├── backend/
│   ├── index.js
│   ├── github/
│   │   └── github.js
│   ├── storage/
│   │   ├── commits/
│   │   └── repos.json
│   ├── utils.js
│   └── .env
│
├── frontend/
│   ├── core/                         # shared logic/assets for all modules
│   │   ├── main.js                   # electron main process
│   │   ├── preload.js                # global preload (console hook, terminal injection, etc.)
│   │   ├── index.html                # landing / module launcher
│   │   ├── designs/                   # shared css
│   │   │   └── styles.css            
│   │
│   ├── modules/                      # ea feature = self-contained modulech
│   │   ├── noteTracker/
│   │   │   ├── views/
│   │   │   │   └── index.html
│   │   │   ├── actions/
│   │   │   │   └── renderer.js
│   │   │   ├── storage/
│   │   │   └── styles/
│   │   │       └── styles.css
│   │   │
│   │   ├── repoTracker/
│   │   │   ├── preload.js          
│   │   │   ├── views/
│   │   │   │   ├── index.html
│   │   │   │   └── profile.html
│   │   │   │   └── repodetail.html
│   │   │   ├── actions/
│   │   │   │   └── renderer.js
│   │   │   │   └── repodetail.js
│   │   │   └── styles/
│   │   │       └── styles.css
│   ├── terminal/  
│   │   │   ├── terminal.js            
│   │   │   ├── terminal-dashboard.html            
│   │
│   └── package.json (optional, if frontend has its own deps)
│
├── package.json
└── README.md
