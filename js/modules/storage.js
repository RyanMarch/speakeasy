/**
 * Speakeasy Local Storage & Portability Module
 * Handles local persistence, JSON export, and JSON import.
 */

const STORAGE_KEY = 'speakeasy_recipes';

export const SEED_RECIPES = [
  {
    id: "old-fashioned",
    name: "Old Fashioned",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange twist & cocktail cherry",
    description: "A classic template highlighting fine whiskey accented by aromatic bitters and rich demerara sweetness.",
    instructions: "1. Add bourbon, demerara syrup, and bitters to a mixing glass filled with ice.\n2. Stir thoroughly for 25-30 seconds until well-chilled and properly diluted.\n3. Strain into a rocks glass over a single large ice cube.\n4. Express orange peel oils over the rim and garnish.",
    source: "Classic",
    sourceUrl: "",
    notes: "",
    tags: ["classic","whiskey-forward","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Bourbon" },
      { amount: 0.25, unit: "oz", name: "Demerara Syrup" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "negroni",
    name: "Negroni",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange peel",
    description: "An iconic Italian aperitivo balancing crisp botanical gin, bitter gentian and orange from Campari, and rich sweet vermouth.",
    instructions: "1. Combine gin, Campari, and sweet vermouth in a mixing glass with cracked ice.\n2. Stir for 20-30 seconds until cold.\n3. Strain into a chilled rocks glass over a large ice sphere or cube.\n4. Garnish with a freshly expressed orange peel.",
    source: "Count Camillo Negroni, Florence (1919)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","aperitivo","bittersweet"],
    specs: [
      { amount: 1, unit: "oz", name: "London Dry Gin" },
      { amount: 1, unit: "oz", name: "Campari" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" },
    ],
  },
  {
    id: "boulevardier",
    name: "Boulevardier",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange twist",
    description: "A whiskey riff on the classic Negroni, created by Erskine Gwynne in 1920s Paris.",
    instructions: "1. Combine bourbon, Campari, and sweet vermouth in a mixing glass filled with ice.\n2. Stir for 25-30 seconds until well-chilled and integrated.\n3. Strain into a rocks glass over a large ice cube or into a chilled coupe.\n4. Express orange peel oils over the drink and garnish.",
    source: "Erskine Gwynne, Paris (1927)",
    sourceUrl: "",
    notes: "Whiskey riff on the Negroni. The rich vanilla and oak tones of bourbon soften the bitter Campari.",
    riffOfId: "negroni",
    riffOfName: "Negroni",
    tags: ["classic","whiskey-forward","aperitivo","riff"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Bourbon" },
      { amount: 1, unit: "oz", name: "Campari" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" },
    ],
  },
  {
    id: "daiquiri",
    name: "Daiquiri",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime wheel",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Shake hard with plenty of ice and fine-strain into a chilled coupe.",
    tags: ["classic","rum","sour","summer"],
    specs: [
      { amount: 2, unit: "oz", name: "White Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Cane Sugar Syrup" },
    ],
  },
  {
    id: "manhattan",
    name: "Manhattan",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Brandied cherry",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Stir thoroughly with ice for 30 seconds to achieve silky dilution and chill.",
    tags: ["classic","whiskey-forward","nightcap"],
    specs: [
      { amount: 2, unit: "oz", name: "Rye Whiskey" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "margarita",
    name: "Margarita",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Half salt rim & lime wedge",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Shake with clean ice and fine-strain into a chilled coupe.",
    tags: ["classic","tequila","party","sour"],
    specs: [
      { amount: 2, unit: "oz", name: "Blanco Tequila" },
      { amount: 1, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.25, unit: "oz", name: "Agave Nectar" },
    ],
  },
  {
    id: "sazerac",
    name: "Sazerac",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Lemon peel (expressed & discarded)",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Chill a rocks glass with ice. Coat with absinthe rinse. Stir remaining spirits with ice and strain neat.",
    tags: ["classic","whiskey-forward","new-orleans"],
    specs: [
      { amount: 2, unit: "oz", name: "Rye Whiskey" },
      { amount: 0.25, unit: "oz", name: "Rich Simple Syrup" },
      { amount: 3, unit: "dashes", name: "Peychaud's Bitters" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
      { amount: null, unit: "rinse", name: "Absinthe" },
    ],
  },
  {
    id: "last-word",
    name: "Last Word",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Brandied cherry",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Equal parts pre-prohibition standard from the Detroit Athletic Club.",
    tags: ["classic","herbal","equal-parts"],
    specs: [
      { amount: 0.75, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Green Chartreuse" },
      { amount: 0.75, unit: "oz", name: "Maraschino Liqueur" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
    ],
  },
  {
    id: "whiskey-sour",
    name: "Whiskey Sour",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Angostura drops & lemon wheel",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Shake with ice and double strain. Optional dry shake with egg white or aquafaba for texture.",
    tags: ["classic","sour","crowd-pleaser"],
    specs: [
      { amount: 2, unit: "oz", name: "Bourbon" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
    ],
  },
  {
    id: "gin-and-tonic",
    name: "Gin & Tonic",
    glassware: "Highball",
    method: "Built",
    garnish: "Lime wedge",
    description: "",
    instructions: "",
    source: "",
    sourceUrl: "",
    notes: "Pour gin over clean ice spears, top with cold tonic water, stir once gently to preserve carbonation.",
    tags: ["classic","refreshing","highball","summer","easy"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 4, unit: "oz", name: "Tonic Water" },
    ],
  },
  {
    id: "dry-martini",
    name: "Dry Martini",
    glassware: "Martini",
    method: "Stirred",
    garnish: "Lemon twist or Castelvetrano olive",
    description: "The archetypal cocktail balancing crisp London dry gin with dry French vermouth and a dash of orange bitters.",
    instructions: "1. Combine gin, dry vermouth, and orange bitters in a mixing glass filled with cracked ice.\n2. Stir briskly for 30 seconds until ice-cold and properly diluted.\n3. Strain into a chilled martini glass.\n4. Express lemon peel oils over the surface or garnish with an olive.",
    source: "Classic (c. 1900)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","spirit-forward","gin-forward","aperitivo"],
    specs: [
      { amount: 2.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Dry Vermouth" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "mai-tai",
    name: "Mai Tai",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Spent lime shell & fresh mint bouquet",
    description: "Trader Vic’s legendary 1944 tropical drink balancing aged rum, nutty almond orgeat, fresh lime, and orange curaçao.",
    instructions: "1. Combine aged rum, fresh lime juice, orange curaçao, orgeat, and demerara syrup in a shaker with crushed ice.\n2. Shake vigorously for 10-12 seconds until frosty.\n3. Pour unstrained into a double rocks glass.\n4. Garnish with a spent lime half and fresh mint sprig to evoke an island with a palm tree.",
    source: "Victor \"Trader Vic\" Bergeron, Oakland (1944)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","tiki","tropical","rum-forward"],
    specs: [
      { amount: 2, unit: "oz", name: "Aged Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Orange Curaçao" },
      { amount: 0.5, unit: "oz", name: "Orgeat" },
      { amount: 0.25, unit: "oz", name: "Demerara Syrup" },
    ],
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Flamed orange peel",
    description: "The defining modern classic popularized by Toby Cecchini, balancing citrus vodka with tart cranberry, lime, and orange liqueur.",
    instructions: "1. Add citron vodka, Cointreau, fresh lime juice, and cranberry juice to an ice-filled shaker.\n2. Shake vigorously for 12-15 seconds until thoroughly chilled.\n3. Fine strain into a chilled coupe.\n4. Express and flame an orange peel over the surface and drop into the drink.",
    source: "Toby Cecchini, The Odeon NYC (1988)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","citrus-forward","party"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Citron Vodka" },
      { amount: 0.75, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Cranberry Juice" },
    ],
  },
  {
    id: "espresso-martini",
    name: "Espresso Martini",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "3 coffee beans",
    description: "Dick Bradsell’s 1980s London sensation uniting rich espresso, vodka, coffee liqueur, and velvety crema foam.",
    instructions: "1. Add vodka, coffee liqueur, fresh hot espresso, and simple syrup into a shaker with hard ice.\n2. Shake hard and fast for 15 seconds to build a dense, creamy foam head.\n3. Double strain promptly into a chilled coupe glass.\n4. Float three coffee beans on the crema in a triangle for health, wealth, and happiness.",
    source: "Dick Bradsell, Fred’s Club London (1983)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","coffee","evening","party"],
    specs: [
      { amount: 2, unit: "oz", name: "Vodka" },
      { amount: 1, unit: "oz", name: "Coffee Liqueur" },
      { amount: 1, unit: "oz", name: "Fresh Espresso" },
      { amount: 0.25, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "french-75",
    name: "French 75",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon twist",
    description: "Named after the rapid-firing French 75mm field gun, pairing bright gin sour acidity with effervescent sparkling wine.",
    instructions: "1. Add gin, lemon juice, and simple syrup to an ice-filled shaker.\n2. Shake briefly for 10 seconds until chilled.\n3. Strain into a chilled flute or coupe glass.\n4. Top gently with cold sparkling wine and garnish with a long lemon twist.",
    source: "Harry’s New York Bar, Paris (1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sparkling","celebratory","citrus-forward"],
    specs: [
      { amount: 1, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Simple Syrup" },
      { amount: 3, unit: "oz", name: "Sparkling Wine" },
    ],
  },
  {
    id: "aperol-spritz",
    name: "Aperol Spritz",
    glassware: "Wine",
    method: "Built",
    garnish: "Orange slice & green olive",
    description: "Venice’s ubiquitous sunlit aperitivo following the classic 3-2-1 ratio of prosecco, bitter aperitivo, and soda.",
    instructions: "1. Fill a stemmed wine glass with abundant fresh ice.\n2. Pour in sparkling wine followed by Aperol in an equal or 3:2 ratio.\n3. Add a splash of club soda and gently stir once from the bottom up.\n4. Garnish with a fresh orange slice.",
    source: "Veneto, Italy (1950s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","aperitivo","sparkling","summer","easy"],
    specs: [
      { amount: 3, unit: "oz", name: "Sparkling Wine" },
      { amount: 2, unit: "oz", name: "Aperol" },
      { amount: 1, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "sidecar",
    name: "Sidecar",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Sugar rim & orange twist",
    description: "The definitive brandy sour created in World War I Paris, balancing rich oak and fruit of Cognac with dry orange liqueur and lemon.",
    instructions: "1. Optionally coat half the rim of a chilled coupe with superfine sugar.\n2. Add Cognac, Cointreau, and lemon juice to a shaker with ice.\n3. Shake vigorously for 12 seconds until thoroughly cold.\n4. Fine strain into the prepared coupe.",
    source: "Ritz Hotel / Harry’s New York Bar, Paris (c. 1920)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","brandy-forward"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Cognac" },
      { amount: 0.75, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "penicillin",
    name: "Penicillin",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Candied ginger & lemon wheel",
    description: "Sam Ross’s 21st-century benchmark whiskey sour layering honey, fiery fresh ginger, and an aromatic Islay peated scotch float.",
    instructions: "1. Add blended scotch, fresh lemon juice, and honey syrup to a shaker with ice.\n2. Shake hard for 12 seconds until cold.\n3. Strain over fresh ice in a rocks glass.\n4. Gently float peated Islay scotch over the back of a barspoon on top of the drink.\n5. Garnish with candied ginger.",
    source: "Sam Ross, Milk & Honey NYC (2005)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","whiskey-forward","sour","smoky"],
    specs: [
      { amount: 2, unit: "oz", name: "Blended Scotch Whisky" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Honey Syrup" },
      { amount: 0.25, unit: "oz", name: "Peated / Islay Scotch" },
    ],
  },
  {
    id: "paloma",
    name: "Paloma",
    glassware: "Highball",
    method: "Built",
    garnish: "Salt rim & grapefruit wedge",
    description: "Mexico’s beloved everyday highball pairing clean blanco tequila, fresh lime, and effervescent tart grapefruit soda.",
    instructions: "1. Rim a tall highball glass with coarse salt and fill with ice cubes.\n2. Add blanco tequila, fresh lime juice, and a pinch of salt or drops of saline.\n3. Top with cold grapefruit soda and stir gently.\n4. Garnish with a fresh grapefruit slice or wedge.",
    source: "Don Javier Delgado Corona, Tequila Mexico (c. 1950s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","highball","tequila-forward","summer","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "Blanco Tequila" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 4, unit: "oz", name: "Grapefruit Soda" },
    ],
  },
  {
    id: "moscow-mule",
    name: "Moscow Mule",
    glassware: "Highball",
    method: "Built",
    garnish: "Lime wheel & mint sprig",
    description: "The drink that sparked the American vodka revolution in 1941, delivering spicy ginger warmth and bright lime snap.",
    instructions: "1. Fill a copper mug or highball glass with crushed or cubed ice.\n2. Add vodka and fresh lime juice.\n3. Top with spicy ginger beer and stir gently to combine.\n4. Garnish with a lime wheel and slapped mint sprig.",
    source: "Cock ‘n Bull, Los Angeles (1941)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","highball","refreshing","summer","easy"],
    specs: [
      { amount: 2, unit: "oz", name: "Vodka" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 4, unit: "oz", name: "Ginger Beer" },
    ],
  },
  {
    id: "tom-collins",
    name: "Tom Collins",
    glassware: "Highball",
    method: "Built",
    garnish: "Lemon wheel & cocktail cherry",
    description: "The timeless sparkling gin lemonade highball, cooling bartenders and patrons since the 19th century.",
    instructions: "1. Add gin, fresh lemon juice, and simple syrup to a shaker with ice and shake briefly.\n2. Strain into a tall Collins glass packed with ice.\n3. Top with cold club soda and stir gently.\n4. Garnish with a lemon wheel and a cherry.",
    source: "Jerry Thomas (1876)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","highball","gin-forward","refreshing","summer"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 3, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "mint-julep",
    name: "Mint Julep",
    glassware: "Rocks",
    method: "Built",
    garnish: "Generous mint bouquet with powdered sugar",
    description: "The legendary drink of the Kentucky Derby, frosting a silver cup with robust bourbon, aromatic spearmint, and cracked ice.",
    instructions: "1. In a julep cup or rocks glass, gently press fresh mint leaves with demerara syrup to release aromatic oils without bruising.\n2. Add bourbon and pack tightly with finely crushed ice.\n3. Swizzle vigorously until the exterior of the cup frosts.\n4. Top with a mound of crushed ice and garnish with a lush mint bouquet.",
    source: "Southern United States (c. 1800)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","whiskey-forward","summer","slow-sipper"],
    specs: [
      { amount: 2.5, unit: "oz", name: "Bourbon" },
      { amount: 0.5, unit: "oz", name: "Demerara Syrup" },
    ],
  },
  {
    id: "mojito",
    name: "Mojito",
    glassware: "Highball",
    method: "Built",
    garnish: "Mint sprig & lime wheel",
    description: "Havana’s timeless highball balancing grassy white rum with fragrant spearmint, tart lime juice, and lively soda.",
    instructions: "1. Gently muddle mint leaves with simple syrup and lime juice in the base of a highball glass.\n2. Add white rum and fill the glass with crushed ice.\n3. Top with club soda and churn gently with a barspoon.\n4. Crown with more crushed ice and slap a fresh mint sprig across the rim.",
    source: "Havana, Cuba (c. 1930s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","highball","rum-forward","summer","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "White Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 2, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "aviation",
    name: "Aviation",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Brandied cherry",
    description: "Hugo Ensslin’s pre-Prohibition gem tinted a delicate sky-blue by crème de violette, offset by tart lemon and maraschino.",
    instructions: "1. Add gin, lemon juice, maraschino liqueur, and crème de violette to a cocktail shaker filled with ice.\n2. Shake hard for 12-15 seconds until chilled.\n3. Double strain into a chilled coupe.\n4. Drop a brandied cherry into the base of the glass.",
    source: "Hugo Ensslin, Hotel Wallick NYC (1916)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","gin-forward","floral"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Maraschino Liqueur" },
      { amount: 0.25, unit: "oz", name: "Crème de Violette" },
    ],
  },
  {
    id: "corpse-reviver-2",
    name: "Corpse Reviver No. 2",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon twist",
    description: "Harry Craddock’s famous morning-after eye-opener delivering equal-parts precision with gin, Lillet, orange liqueur, and absinthe.",
    instructions: "1. Rinse a chilled coupe with absinthe and discard any excess.\n2. Add gin, Cointreau, Lillet Blanc, and fresh lemon juice to a shaker with ice.\n3. Shake hard for 12 seconds until thoroughly chilled.\n4. Fine strain into the prepared coupe and garnish with an expressed lemon twist.",
    source: "Harry Craddock, Savoy Cocktail Book (1930)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","gin-forward","aperitivo"],
    specs: [
      { amount: 0.75, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Lillet Blanc" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: null, unit: "rinse", name: "Absinthe" },
    ],
  },
  {
    id: "americano",
    name: "Americano",
    glassware: "Highball",
    method: "Built",
    garnish: "Orange slice",
    description: "The gentler sparkling forebear to the Negroni, created at Gaspare Campari’s bar and championed by American tourists in Milan.",
    instructions: "1. Fill a highball glass with fresh ice.\n2. Pour in equal parts Campari and sweet vermouth.\n3. Top with cold club soda and give one gentle stir from bottom to top.\n4. Garnish with a fresh orange half-wheel.",
    source: "Caffè Campari, Milan (1860s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","aperitivo","highball","bittersweet","easy"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Campari" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "vieux-carre",
    name: "Vieux Carré",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Lemon peel & brandied cherry",
    description: "Walter Bergeron’s tribute to the New Orleans French Quarter, uniting rye, Cognac, sweet vermouth, Bénédictine, and dual bitters.",
    instructions: "1. Combine rye whiskey, Cognac, sweet vermouth, Bénédictine, and both bitters in a mixing glass with ice.\n2. Stir thoroughly for 30 seconds until cold and glossy.\n3. Strain into a rocks glass over a single large ice cube.\n4. Express lemon peel oils over the glass and garnish.",
    source: "Walter Bergeron, Carousel Bar New Orleans (1938)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","spirit-forward","whiskey-forward","slow-sipper"],
    specs: [
      { amount: 0.75, unit: "oz", name: "Rye Whiskey" },
      { amount: 0.75, unit: "oz", name: "Cognac" },
      { amount: 0.75, unit: "oz", name: "Sweet Vermouth" },
      { amount: 0.25, unit: "oz", name: "Bénédictine" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
      { amount: 1, unit: "dash", name: "Peychaud's Bitters" },
    ],
  },
  {
    id: "pisco-sour",
    name: "Pisco Sour",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "3 drops Angostura Bitters on foam",
    description: "The national drink of Peru, shaking grape brandy with tart lime, simple syrup, and egg white for a silken meringue crown.",
    instructions: "1. Add pisco, lime juice, simple syrup, and egg white to a shaker.\n2. Dry shake without ice for 10 seconds to emulsify the albumen.\n3. Add ice and shake hard for 12 seconds until frosty.\n4. Double strain into a chilled coupe.\n5. Drop 3 dots of Angostura bitters across the foam head.",
    source: "Victor Morris, Morris’ Bar Lima (1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","silky"],
    specs: [
      { amount: 2, unit: "oz", name: "Pisco" },
      { amount: 1, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 0.75, unit: "oz", name: "Egg White" },
      { amount: 3, unit: "drops", name: "Angostura Bitters" },
    ],
  },
  {
    id: "gimlet",
    name: "Gimlet",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime wheel",
    description: "The crisp Royal Navy sour pairing sharp botanical gin with bracing lime acidity and balanced sweetness.",
    instructions: "1. Combine gin, fresh lime juice, and simple syrup in a shaker with ice.\n2. Shake hard for 12 seconds until well-chilled.\n3. Fine strain into a chilled coupe.\n4. Float a thin lime wheel on the surface.",
    source: "British Royal Navy (c. late 19th century)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","sour","gin-forward","citrus-forward"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "dark-n-stormy",
    name: "Dark 'n Stormy",
    glassware: "Highball",
    method: "Built",
    garnish: "Lime wedge",
    description: "Bermuda’s maritime highball floating brooding black rum over effervescent spicy ginger beer, evoking a tempest at sea.",
    instructions: "1. Fill a tall highball glass with ice.\n2. Pour in spicy ginger beer and fresh lime juice, then give a brief stir.\n3. Carefully float blackstrap rum over the top using the back of a barspoon.\n4. Garnish with a fresh lime wedge on the rim.",
    source: "Gosling Brothers, Bermuda (c. 1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["classic","highball","rum-forward","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "Black / Blackstrap Rum" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 4, unit: "oz", name: "Ginger Beer" },
    ],
  },
  {
    id: "paper-plane",
    name: "Paper Plane",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Miniature paper plane or lemon twist",
    description: "A modern four-part masterpiece created by Sam Ross, striking a sublime harmony between rich bourbon, bittersweet Aperol, herbal Amaro Nonino, and tart lemon.",
    instructions: "1. Add bourbon, Aperol, Amaro Nonino, and fresh lemon juice to a cocktail shaker filled with ice.\n2. Shake hard for 12-15 seconds until thoroughly chilled and aerated.\n3. Double strain into a chilled coupe.\n4. Optionally garnish with a tiny origami paper plane perched on the rim.",
    source: "Sam Ross, The Violet Hour / Milk & Honey (2007)",
    sourceUrl: "",
    notes: "An equal-parts modern riff on the Last Word, trading gin and chartreuse for bourbon and Italian aperitifs.",
    riffOfId: "last-word",
    riffOfName: "Last Word",
    tags: ["modern-craft","sour","bittersweet","equal-parts"],
    specs: [
      { amount: 0.75, unit: "oz", name: "Bourbon" },
      { amount: 0.75, unit: "oz", name: "Aperol" },
      { amount: 0.75, unit: "oz", name: "Amaro Nonino" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "naked-and-famous",
    name: "Naked and Famous",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime wheel",
    description: "Joaquín Simó’s equal-parts gem blending earthy smoky mezcal with radiant Yellow Chartreuse, bittersweet Aperol, and brisk lime juice.",
    instructions: "1. Combine mezcal, Yellow Chartreuse, Aperol, and fresh lime juice in a shaker with cubed ice.\n2. Shake vigorously until frosting forms on the tin.\n3. Fine strain into a chilled coupe.\n4. Garnish with a fresh lime wheel.",
    source: "Joaquín Simó, Death & Co NYC (2011)",
    sourceUrl: "",
    notes: "Simó described this modern classic as the bastard love child of a Last Word and a Paper Plane.",
    riffOfId: "last-word",
    riffOfName: "Last Word",
    tags: ["modern-craft","mezcal-forward","smoky","equal-parts","sour"],
    specs: [
      { amount: 0.75, unit: "oz", name: "Mezcal" },
      { amount: 0.75, unit: "oz", name: "Yellow Chartreuse" },
      { amount: 0.75, unit: "oz", name: "Aperol" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
    ],
  },
  {
    id: "bramble",
    name: "Bramble",
    glassware: "Rocks",
    method: "Built",
    garnish: "Fresh blackberry & lemon slice",
    description: "Dick Bradsell’s quintessential 1980s London creation: crisp gin sour served over crushed ice with a cascading float of velvety blackberry liqueur.",
    instructions: "1. Add London dry gin, fresh lemon juice, and simple syrup to a shaker with ice and shake briefly.\n2. Strain into an Old Fashioned glass packed with crushed ice.\n3. Slowly drizzle blackberry liqueur over the crown of crushed ice to create a bleeding marbled effect.\n4. Garnish with two fresh blackberries and a lemon half-wheel.",
    source: "Dick Bradsell, Fred's Club London (1984)",
    sourceUrl: "",
    notes: "",
    tags: ["modern-craft","gin-forward","fruity","sour","crushed-ice"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Simple Syrup" },
      { amount: 0.5, unit: "oz", name: "Crème de Mûre" },
    ],
  },
  {
    id: "jungle-bird",
    name: "Jungle Bird",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Pineapple fronds & maraschino cherry",
    description: "A dark, tropical revelation pairing robust blackstrap rum with luscious pineapple and the surprising bitter bite of Italian Campari.",
    instructions: "1. Combine blackstrap rum, Campari, fresh pineapple juice, fresh lime juice, and demerara syrup in a shaker.\n2. Shake hard with ice for 15 seconds to create a creamy pineapple foam.\n3. Strain over fresh crushed ice in an Old Fashioned glass or tiki goblet.\n4. Fan pineapple fronds and skewer a cocktail cherry for garnish.",
    source: "Jeffrey Ong, Aviary Bar, Kuala Lumpur Hilton (1973)",
    sourceUrl: "",
    notes: "",
    tags: ["modern-craft","tropical-tiki","rum-forward","bittersweet"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Black / Blackstrap Rum" },
      { amount: 0.75, unit: "oz", name: "Campari" },
      { amount: 1.5, unit: "oz", name: "Pineapple Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Demerara Syrup" },
    ],
  },
  {
    id: "tommys-margarita",
    name: "Tommy's Margarita",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Lime wedge & half salt rim",
    description: "Julio Bermejo’s groundbreaking Californian recipe that strips away orange liqueur, letting pure 100% agave tequila shine alongside lime and agave nectar.",
    instructions: "1. Combine 100% agave blanco tequila, fresh lime juice, and agave nectar in a shaker with cubed ice.\n2. Shake vigorously for 12 seconds until frosty.\n3. Strain over fresh ice into a rocks glass (optionally half-rimmed with sea salt).\n4. Garnish with a fresh lime wedge.",
    source: "Julio Bermejo, Tommy's Mexican Restaurant, San Francisco (1990)",
    sourceUrl: "",
    notes: "The definitive pure-agave Margarita template that transformed agave cocktails globally.",
    riffOfId: "margarita",
    riffOfName: "Margarita",
    tags: ["modern-craft","agave-forward","sour","crisp"],
    specs: [
      { amount: 2, unit: "oz", name: "Blanco Tequila" },
      { amount: 1, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Agave Nectar" },
    ],
  },
  {
    id: "oaxaca-old-fashioned",
    name: "Oaxaca Old Fashioned",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Flamed orange peel",
    description: "Phil Ward’s legendary Death & Co pioneer bridging reposado tequila and smoky mezcal under an aromatic cloud of flamed orange oils.",
    instructions: "1. Combine reposado tequila, mezcal, agave nectar, and Angostura bitters in a mixing glass filled with ice.\n2. Stir patiently for 30 seconds until silky and cold.\n3. Strain over a single large ice cube into an Old Fashioned glass.\n4. Express and flame an orange peel over the glass, then drop it in.",
    source: "Phil Ward, Death & Co NYC (2007)",
    sourceUrl: "",
    notes: "Credited with igniting the American craft cocktail obsession with artisanal mezcal.",
    riffOfId: "old-fashioned",
    riffOfName: "Old Fashioned",
    tags: ["modern-craft","smoky","agave-forward","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Reposado Tequila" },
      { amount: 0.5, unit: "oz", name: "Mezcal" },
      { amount: 0.25, unit: "oz", name: "Agave Nectar" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "gin-basil-smash",
    name: "Gin Basil Smash",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Fresh basil sprig",
    description: "Jörg Meyer’s vibrant emerald smash packing a garden-fresh bouquet of muddled basil leaves balanced by crisp London dry gin and bright lemon.",
    instructions: "1. Muddle a generous handful of fresh basil leaves with simple syrup in a cocktail shaker.\n2. Add gin, lemon juice, and plenty of ice.\n3. Shake violently until the herbs surrender their green oils and the tin is ice-cold.\n4. Double strain through a fine mesh strainer over fresh ice into a rocks glass.\n5. Garnish with a spapped basil top.",
    source: "Jörg Meyer, Le Lion, Hamburg (2008)",
    sourceUrl: "",
    notes: "",
    tags: ["modern-craft","gin-forward","herbal","sour","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "industry-sour",
    name: "Industry Sour",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime twist",
    description: "A cult favorite among hospitality veterans combining equal parts Fernet-Branca and pungent Green Chartreuse into an intense, surprisingly harmonious sour.",
    instructions: "1. Combine Fernet-Branca, Green Chartreuse, fresh lime juice, and simple syrup in a shaker with ice.\n2. Shake with maximum force for 15 seconds.\n3. Fine strain into a chilled coupe glass.\n4. Garnish with a lime twist expressed over the surface.",
    source: "Ted Kilgore, Taste, St. Louis (2011)",
    sourceUrl: "",
    notes: "An unapologetic bartenders handshake cocktail created from two beloved industry spirits.",
    riffOfId: "last-word",
    riffOfName: "Last Word",
    tags: ["modern-craft","herbal","bitter","equal-parts","sour"],
    specs: [
      { amount: 0.75, unit: "oz", name: "Fernet-Branca" },
      { amount: 0.75, unit: "oz", name: "Green Chartreuse" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "division-bell",
    name: "Division Bell",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Grapefruit twist",
    description: "Phil Ward’s Pink Floyd-inspired Last Word sibling highlighting smoky mezcal, bittersweet Aperol, tart lime, and delicate maraschino notes.",
    instructions: "1. Combine mezcal, Aperol, maraschino liqueur, and fresh lime juice in an ice-filled shaker.\n2. Shake well for 12 seconds.\n3. Fine strain into a chilled coupe.\n4. Twist a grapefruit peel over the surface and drop it in.",
    source: "Phil Ward, Mayahuel NYC (2009)",
    sourceUrl: "",
    notes: "",
    riffOfId: "last-word",
    riffOfName: "Last Word",
    tags: ["modern-craft","mezcal-forward","smoky","bittersweet"],
    specs: [
      { amount: 1, unit: "oz", name: "Mezcal" },
      { amount: 0.75, unit: "oz", name: "Aperol" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Maraschino Liqueur" },
    ],
  },
  {
    id: "left-hand",
    name: "Left Hand",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Brandied cherry",
    description: "Sam Ross’s velvety evolution of the Boulevardier, anchoring fine bourbon and bitter Campari with chocolate bitters for a confectionary, seductive finish.",
    instructions: "1. Combine bourbon, Campari, sweet vermouth, and chocolate bitters in a mixing glass with ice.\n2. Stir gently for 30 seconds until well chilled and integrated.\n3. Strain into a chilled coupe glass.\n4. Drop a brandied Luxardo cherry into the bottom.",
    source: "Sam Ross, Milk & Honey NYC (2007)",
    sourceUrl: "",
    notes: "",
    riffOfId: "boulevardier",
    riffOfName: "Boulevardier",
    tags: ["modern-craft","whiskey-forward","bittersweet","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Bourbon" },
      { amount: 0.75, unit: "oz", name: "Campari" },
      { amount: 0.75, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "dashes", name: "Chocolate Bitters" },
    ],
  },
  {
    id: "white-negroni",
    name: "White Negroni",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Grapefruit peel or lemon twist",
    description: "Wayne Collins’s brilliant pale reimagining of the Negroni, trading red Campari and vermouth for earthy French gentian liqueur and golden Lillet Blanc.",
    instructions: "1. Add gin, Lillet Blanc, and Suze gentian liqueur to a mixing glass filled with ice.\n2. Stir smoothly for 25-30 seconds until properly diluted and chilled.\n3. Strain over a large ice rock into an Old Fashioned glass.\n4. Express a swath of grapefruit peel over the rim and insert.",
    source: "Wayne Collins, VinExpo Bordeaux (2001)",
    sourceUrl: "",
    notes: "",
    riffOfId: "negroni",
    riffOfName: "Negroni",
    tags: ["modern-craft","gin-forward","bittersweet","aperitivo"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 1, unit: "oz", name: "Lillet Blanc" },
      { amount: 0.75, unit: "oz", name: "Suze" },
    ],
  },
  {
    id: "trinidad-sour",
    name: "Trinidad Sour",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon peel twist",
    description: "An audacious modern miracle flipping traditional cocktail balance on its head by deploying a massive pour of Angostura Bitters as the primary base spirit.",
    instructions: "1. Add Angostura Bitters, rye whiskey, orgeat, and fresh lemon juice to a cocktail shaker.\n2. Fill with solid ice cubes and shake vigorously for 15 seconds.\n3. Double strain into a chilled coupe glass.\n4. Garnish with a twist of lemon.",
    source: "Valentino Bolognese, Angostura Global Cocktail Challenge (2009)",
    sourceUrl: "",
    notes: "Proof that aromatic cocktail bitters can stand proudly as a full-fledged base spirit when balanced with creamy orgeat.",
    tags: ["modern-craft","spicy","herbal","sour","adventurous"],
    specs: [
      { amount: 1, unit: "oz", name: "Angostura Bitters" },
      { amount: 0.5, unit: "oz", name: "Rye Whiskey" },
      { amount: 1, unit: "oz", name: "Orgeat" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "revolver",
    name: "Revolver",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Flamed orange twist",
    description: "Jon Santer’s rich San Francisco nightcap marrying high-rye bourbon with dark coffee liqueur and aromatic orange bitters.",
    instructions: "1. Add bourbon, coffee liqueur, and orange bitters to a mixing glass filled with cracked ice.\n2. Stir for 25-30 seconds until thoroughly chilled and combined.\n3. Strain into a chilled coupe.\n4. Flame an orange peel over the glass and float it atop.",
    source: "Jon Santer, Bruno's, San Francisco (2004)",
    sourceUrl: "",
    notes: "",
    tags: ["modern-craft","whiskey-forward","coffee","nightcap","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Bourbon" },
      { amount: 0.5, unit: "oz", name: "Coffee Liqueur" },
      { amount: 2, unit: "dashes", name: "Orange Bitters" },
    ],
  },
  {
    id: "black-manhattan",
    name: "Black Manhattan",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Brandied cherry",
    description: "Todd Smith’s dark, moody Manhattan variant replacing sweet vermouth with bittersweet Sicilian Amaro Averna.",
    instructions: "1. Combine rye whiskey, Amaro Averna, and both bitters in a mixing glass with plenty of ice.\n2. Stir for 30 seconds until cold and silky.\n3. Strain into a chilled coupe or cocktail glass.\n4. Garnish with a brandied Luxardo cherry.",
    source: "Todd Smith, Bourbon & Branch, San Francisco (2005)",
    sourceUrl: "",
    notes: "",
    riffOfId: "manhattan",
    riffOfName: "Manhattan",
    tags: ["modern-craft","whiskey-forward","bittersweet","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Rye Whiskey" },
      { amount: 1, unit: "oz", name: "Amaro Averna" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "jasmine",
    name: "Jasmine",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon twist",
    description: "Paul Harrington’s deceptive classic that tastes remarkably like fresh pink grapefruit juice despite containing none, built from gin, Campari, and Cointreau.",
    instructions: "1. Add gin, Campari, Cointreau, and fresh lemon juice to a shaker with ice.\n2. Shake briskly for 12 seconds until chilled.\n3. Double strain into a chilled coupe.\n4. Garnish with an expressed lemon twist.",
    source: "Paul Harrington, Townhouse Bar, Emeryville CA (c. 1990s)",
    sourceUrl: "",
    notes: "",
    tags: ["modern-craft","gin-forward","sour","bittersweet"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.25, unit: "oz", name: "Campari" },
      { amount: 0.25, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "zombie",
    name: "Zombie",
    glassware: "Tiki Mug",
    method: "Shaken",
    garnish: "Mint sprig, cinnamon stick & cherry",
    description: "Don the Beachcomber’s legendary tiki juggernaut weaving three rums with citrus, cinnamon, falernum, and a haunting hint of absinthe.",
    instructions: "1. Combine light rum, dark rum, overproof rum, lime juice, grapefruit juice, cinnamon syrup, falernum, grenadine, absinthe, and Angostura bitters in a shaker with cracked ice.\n2. Shake violently for 15 seconds.\n3. Pour unstrained into a tall tiki mug or Collins glass.\n4. Top with crushed ice and garnish lavishly with mint and a cinnamon stick.",
    source: "Donn Beach, Don the Beachcomber, Hollywood (1934)",
    sourceUrl: "",
    notes: "Famously limited to two per customer due to its immense alcoholic potency.",
    tags: ["tropical-tiki","rum-forward","complex","potent"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Light Rum" },
      { amount: 1.5, unit: "oz", name: "Dark Rum" },
      { amount: 1, unit: "oz", name: "Overproof Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Grapefruit Juice" },
      { amount: 0.5, unit: "oz", name: "Cinnamon Syrup" },
      { amount: 0.5, unit: "oz", name: "Falernum" },
      { amount: 1, unit: "barspoon", name: "Grenadine" },
      { amount: 2, unit: "drops", name: "Absinthe" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
    ],
  },
  {
    id: "painkiller",
    name: "Painkiller",
    glassware: "Tiki Mug",
    method: "Shaken",
    garnish: "Freshly grated nutmeg & pineapple wedge",
    description: "The British Virgin Islands icon balancing rich dark navy rum with lush pineapple, orange juice, and creamy coconut under a dusting of aromatic nutmeg.",
    instructions: "1. Combine dark rum, pineapple juice, orange juice, and cream of coconut in a shaker with crushed ice.\n2. Shake hard for 15 seconds to emulsify the coconut.\n3. Pour into a tall glass or tiki mug filled with fresh crushed ice.\n4. Generously grate fresh whole nutmeg over the top and garnish with a pineapple wedge.",
    source: "Daphne Henderson, Soggy Dollar Bar, Jost Van Dyke (1970s)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","creamy","fruity"],
    specs: [
      { amount: 2, unit: "oz", name: "Dark Rum" },
      { amount: 4, unit: "oz", name: "Pineapple Juice" },
      { amount: 1, unit: "oz", name: "Orange Juice" },
      { amount: 1, unit: "oz", name: "Cream of Coconut" },
    ],
  },
  {
    id: "pina-colada",
    name: "Piña Colada",
    glassware: "Highball",
    method: "Blended",
    garnish: "Pineapple wedge & maraschino cherry",
    description: "Puerto Rico’s national cocktail blending crisp white rum, sweet cream of coconut, and fresh pineapple juice into a velvety frozen tropical escape.",
    instructions: "1. Add white rum, cream of coconut, and fresh pineapple juice into a blender with a scoop of crushed ice.\n2. Blend on high speed for 20 seconds until silky and smooth.\n3. Pour into a chilled hurricane or highball glass.\n4. Garnish with a fresh pineapple triangle and maraschino cherry.",
    source: "Ramón \"Monchito\" Marrero, Caribe Hilton, San Juan (1954)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","creamy","sweet"],
    specs: [
      { amount: 2, unit: "oz", name: "Light Rum" },
      { amount: 2, unit: "oz", name: "Cream of Coconut" },
      { amount: 3, unit: "oz", name: "Pineapple Juice" },
    ],
  },
  {
    id: "caipirinha",
    name: "Caipirinha",
    glassware: "Rocks",
    method: "Built",
    garnish: "Lime wheels",
    description: "Brazil’s vibrant national cocktail showcasing grassy, rustic sugarcane cachaça muddled vigorously with fresh lime quarters and sugar.",
    instructions: "1. Cut a fresh lime into small wedges and place in a double rocks glass.\n2. Add simple syrup or fine sugar and muddle vigorously to express juice and essential peel oils.\n3. Fill the glass with cracked ice and pour in the cachaça.\n4. Stir well to integrate the sugar and garnish with lime wheels.",
    source: "Brazilian Classic (c. early 20th century)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","cachaca-forward","sour","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "Cachaça" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
    ],
  },
  {
    id: "ti-punch",
    name: "Ti' Punch",
    glassware: "Rocks",
    method: "Built",
    garnish: "Lime disc",
    description: "The soul of the French Caribbean: Martinique’s minimalist ritual uniting raw floral Rhum Agricole with cane syrup and a lime disc.",
    instructions: "1. Add cane sugar syrup or demerara syrup to a small tumbler.\n2. Cut a small disc of lime peel with a little flesh and squeeze it into the glass.\n3. Add unaged Rhum Agricole.\n4. Stir with a bois lélé swizzle stick or barspoon.\n5. Enjoy at room temperature or with a single ice cube.",
    source: "Martinique & Guadeloupe Traditional",
    sourceUrl: "",
    notes: "Traditionally served with the bottle on the table so the drinker can prepare their own measure (chacun prépare sa propre mort).",
    tags: ["tropical-tiki","rhum-agricole","spirit-forward","minimalist"],
    specs: [
      { amount: 2, unit: "oz", name: "Rhum Agricole" },
      { amount: 0.25, unit: "oz", name: "Cane Sugar Syrup" },
      { amount: 0.25, unit: "oz", name: "Fresh Lime Juice" },
    ],
  },
  {
    id: "three-dots-and-a-dash",
    name: "Three Dots and a Dash",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Three cocktail cherries and a pineapple frond",
    description: "Don the Beachcomber’s WWII victory tribute—Morse code for \"V\"—marrying grassy agricole and dark rums with warm honey and allspice.",
    instructions: "1. Combine Rhum Agricole, dark rum, lime juice, orange juice, honey syrup, falernum, and allspice dram in a shaker with cracked ice.\n2. Shake vigorously for 15 seconds.\n3. Fine strain into a chilled coupe or goblet.\n4. Garnish with three skewered maraschino cherries and a pineapple spear (three dots and a dash).",
    source: "Donn Beach, Hollywood (c. 1940s)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","spiced","complex"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Rhum Agricole" },
      { amount: 0.5, unit: "oz", name: "Dark Rum" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Orange Juice" },
      { amount: 0.5, unit: "oz", name: "Honey Syrup" },
      { amount: 0.25, unit: "oz", name: "Falernum" },
      { amount: 1, unit: "dash", name: "Allspice Dram" },
    ],
  },
  {
    id: "navy-grog",
    name: "Navy Grog",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Classic ice cone & straw",
    description: "A formidable maritime tiki staple balancing three heavy rums against tart lime, bittersweet grapefruit, and rich honey syrup.",
    instructions: "1. Add light rum, dark rum, and Demerara rum with lime juice, grapefruit juice, honey syrup, and a splash of club soda to a shaker with ice.\n2. Shake hard for 12 seconds.\n3. Strain over a solid ice cone in a double rocks glass.\n4. Insert a straw directly through the ice cone.",
    source: "Victor \"Trader Vic\" Bergeron (1941)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","potent","sour"],
    specs: [
      { amount: 1, unit: "oz", name: "Light Rum" },
      { amount: 1, unit: "oz", name: "Dark Rum" },
      { amount: 1, unit: "oz", name: "Overproof Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Grapefruit Juice" },
      { amount: 0.75, unit: "oz", name: "Honey Syrup" },
      { amount: 1, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "singapore-sling",
    name: "Singapore Sling",
    glassware: "Highball",
    method: "Shaken",
    garnish: "Pineapple slice & cocktail cherry",
    description: "The historic Raffles Hotel creation delivering a botanical cascade of gin, cherry liqueur, Bénédictine, and sparkling effervescence.",
    instructions: "1. Combine gin, Cherry Heering, Cointreau, Bénédictine, pineapple juice, lime juice, grenadine, and bitters in an ice-filled shaker.\n2. Shake hard for 15 seconds until cold and foamy.\n3. Strain into a tall highball glass filled with ice.\n4. Top with club soda and garnish with fresh pineapple and cherry.",
    source: "Ngiam Tong Boon, Long Bar, Raffles Hotel (c. 1915)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","gin-forward","fruity","complex","highball"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Cherry Heering" },
      { amount: 0.25, unit: "oz", name: "Cointreau" },
      { amount: 0.25, unit: "oz", name: "Bénédictine" },
      { amount: 2, unit: "oz", name: "Pineapple Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 1, unit: "barspoon", name: "Grenadine" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
    ],
  },
  {
    id: "saturn",
    name: "Saturn",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon peel ring surrounding a cherry",
    description: "One of the rare world-class gin-based tiki cocktails, matching London dry gin with passion fruit, orgeat, and spicy falernum.",
    instructions: "1. Add gin, lemon juice, passion fruit syrup, orgeat, and falernum to a cocktail shaker with crushed ice.\n2. Shake vigorously for 15 seconds until well-chilled.\n3. Fine strain into a chilled coupe.\n4. Garnish with a circular lemon peel resembling planetary rings pierced with a cocktail cherry.",
    source: "J. \"Popo\" Galsini, IBA World Championship winner (1967)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","gin-forward","fruity","sour"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Passion Fruit Syrup" },
      { amount: 0.25, unit: "oz", name: "Orgeat" },
      { amount: 0.25, unit: "oz", name: "Falernum" },
    ],
  },
  {
    id: "corn-n-oil",
    name: "Corn 'n Oil",
    glassware: "Rocks",
    method: "Built",
    garnish: "Lime wedge",
    description: "Barbados’s straightforward, brooding favorite floating dark molasses-rich blackstrap rum over spicy clove-forward falernum and lime.",
    instructions: "1. In a rocks glass filled with crushed ice, add falernum and fresh lime juice.\n2. Stir briefly to chill.\n3. Float blackstrap rum gently over the top to resemble dark crude oil floating on golden liquid.\n4. Add a dash of Angostura bitters and garnish with lime.",
    source: "Traditional Bajan Cocktail, Barbados",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","spiced","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Black / Blackstrap Rum" },
      { amount: 0.75, unit: "oz", name: "Falernum" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "fog-cutter",
    name: "Fog Cutter",
    glassware: "Highball",
    method: "Shaken",
    garnish: "Mint sprig & orange wheel",
    description: "Trader Vic’s potent restorative combining white rum, cognac, and gin with citrus and almond, finished with a crown of cream sherry.",
    instructions: "1. Combine light rum, cognac, gin, lemon juice, orange juice, and orgeat in a shaker with ice.\n2. Shake hard for 15 seconds.\n3. Pour unstrained into a tall tiki mug or Collins glass.\n4. Float dry sherry over the top and garnish with mint and orange.",
    source: "Victor \"Trader Vic\" Bergeron (1940s)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","potent","citrus-forward","complex"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Light Rum" },
      { amount: 0.75, unit: "oz", name: "Cognac" },
      { amount: 0.5, unit: "oz", name: "London Dry Gin" },
      { amount: 1.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 1, unit: "oz", name: "Orange Juice" },
      { amount: 0.5, unit: "oz", name: "Orgeat" },
      { amount: 0.5, unit: "oz", name: "Dry Sherry" },
    ],
  },
  {
    id: "blue-hawaii",
    name: "Blue Hawaii",
    glassware: "Highball",
    method: "Shaken",
    garnish: "Pineapple wedge & cocktail umbrella",
    description: "The mid-century Waikiki phenomenon bathing rum, vodka, and pineapple in the vivid aquamarine hue of blue curaçao.",
    instructions: "1. Combine white rum, vodka, blue curaçao, pineapple juice, and sweet & sour in an ice-filled shaker.\n2. Shake for 12 seconds until icy.\n3. Strain over fresh crushed ice into a tall hurricane glass.\n4. Garnish with a pineapple wedge and paper umbrella.",
    source: "Harry Yee, Kaiser Hawaiian Village Hotel, Waikiki (1957)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","sweet","refreshing"],
    specs: [
      { amount: 1, unit: "oz", name: "Light Rum" },
      { amount: 1, unit: "oz", name: "Vodka" },
      { amount: 0.75, unit: "oz", name: "Blue Curaçao" },
      { amount: 3, unit: "oz", name: "Pineapple Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "hurricane",
    name: "Hurricane",
    glassware: "Highball",
    method: "Shaken",
    garnish: "Orange slice & cocktail cherry",
    description: "New Orleans’s French Quarter legend shaking generous measures of light and dark rum with tart lemon juice and luscious passion fruit syrup.",
    instructions: "1. Combine dark rum, light rum, passion fruit syrup, lemon juice, orange juice, and grenadine in a shaker with crushed ice.\n2. Shake hard for 12 seconds.\n3. Pour into a signature curved hurricane glass.\n4. Garnish with an orange slice and maraschino cherry.",
    source: "Pat O'Brien's Bar, New Orleans (c. 1940s)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","fruity","potent"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Light Rum" },
      { amount: 1.5, unit: "oz", name: "Dark Rum" },
      { amount: 1, unit: "oz", name: "Passion Fruit Syrup" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Orange Juice" },
      { amount: 1, unit: "barspoon", name: "Grenadine" },
    ],
  },
  {
    id: "hotel-nacional",
    name: "Hotel Nacional Special",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime wheel",
    description: "Havana’s golden age coupe highlighting crisp Cuban-style rum, velvety apricot liqueur, and fresh pineapple frothed to an airy foam.",
    instructions: "1. Combine white rum, fresh pineapple juice, fresh lime juice, apricot liqueur, and simple syrup in a shaker.\n2. Shake hard with ice for 15 seconds to develop a thick, velvety head of pineapple foam.\n3. Double strain into a chilled coupe.\n4. Garnish with a thin lime wheel floated in the foam.",
    source: "Wil P. Taylor, Hotel Nacional de Cuba, Havana (1930s)",
    sourceUrl: "",
    notes: "",
    tags: ["tropical-tiki","rum-forward","fruity","sour"],
    specs: [
      { amount: 1.5, unit: "oz", name: "White Rum" },
      { amount: 1, unit: "oz", name: "Pineapple Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Apricot Liqueur" },
      { amount: 0.25, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "hemingway-daiquiri",
    name: "Hemingway Daiquiri",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lime wheel & maraschino cherry",
    description: "Crafted for Ernest Hemingway at El Floridita, doubling down on white rum with tart pink grapefruit and Italian maraschino liqueur in place of sugar.",
    instructions: "1. Combine white rum, fresh lime juice, grapefruit juice, and maraschino liqueur in a shaker with plenty of ice.\n2. Shake hard for 12 seconds until thoroughly cold.\n3. Double strain into a chilled coupe.\n4. Garnish with a lime wheel and cherry.",
    source: "Constantino Ribalaigua Vert, El Floridita, Havana (c. 1930s)",
    sourceUrl: "",
    notes: "Originally requested by Hemingway without sugar to accommodate his diabetes, later balanced with a touch of maraschino by the bar.",
    riffOfId: "daiquiri",
    riffOfName: "Daiquiri",
    tags: ["tropical-tiki","rum-forward","sour","crisp"],
    specs: [
      { amount: 2, unit: "oz", name: "White Rum" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.5, unit: "oz", name: "Grapefruit Juice" },
      { amount: 0.5, unit: "oz", name: "Maraschino Liqueur" },
    ],
  },
  {
    id: "martinez",
    name: "Martinez",
    glassware: "Nick & Nora",
    method: "Stirred",
    garnish: "Lemon twist or maraschino cherry",
    description: "The profound evolutionary bridge between the Manhattan and the Dry Martini, combining sweet vermouth, malty Old Tom gin, and maraschino.",
    instructions: "1. Add Old Tom gin, sweet vermouth, maraschino liqueur, and bitters to a mixing glass filled with ice.\n2. Stir smoothly for 30 seconds until cold and blended.\n3. Strain into a chilled Nick & Nora glass.\n4. Express lemon peel oils over the surface.",
    source: "O.H. Byron, The Modern Bartenders' Guide (1884)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","gin-forward","bittersweet","ancestor","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Old Tom Gin" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
      { amount: 1, unit: "barspoon", name: "Maraschino Liqueur" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "hanky-panky",
    name: "Hanky Panky",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Orange twist",
    description: "Ada Coleman’s historic 1903 Savoy Hotel gem, elevating equal parts gin and sweet vermouth with a medicinal dash of bitter Fernet-Branca.",
    instructions: "1. Combine gin, sweet vermouth, and Fernet-Branca in a mixing glass with ice.\n2. Stir patiently for 30 seconds.\n3. Strain into a chilled coupe.\n4. Express orange peel oils over the drink and garnish.",
    source: "Ada Coleman, American Bar, Savoy Hotel London (1903)",
    sourceUrl: "",
    notes: "Created for the comedic actor Charles Hawtrey, who exclaimed: By Jove, Coley, that is the real hanky-panky!",
    tags: ["prohibition-era","gin-forward","bittersweet","historic"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "dashes", name: "Fernet-Branca" },
    ],
  },
  {
    id: "bees-knees",
    name: "Bee's Knees",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon twist",
    description: "Prohibition ingenuity at its finest, softening botanical gin with soothing honey syrup and tart fresh lemon juice.",
    instructions: "1. Combine gin, fresh lemon juice, and honey syrup in a cocktail shaker filled with ice.\n2. Shake hard for 12 seconds.\n3. Double strain into a chilled coupe.\n4. Garnish with an expressed lemon twist.",
    source: "Prohibition Era (c. 1920s)",
    sourceUrl: "",
    notes: "Named after 1920s slang meaning the absolute best.",
    tags: ["prohibition-era","gin-forward","sour","crisp"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Honey Syrup" },
    ],
  },
  {
    id: "southside",
    name: "Southside",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Mint leaf floated atop",
    description: "The aristocratic country club and speakeasy standard delivering a crisp gin sour perfumed with muddled aromatic mint.",
    instructions: "1. Add fresh mint leaves and simple syrup to a shaker and gently press with a muddler.\n2. Add gin, lime juice, and ice.\n3. Shake hard for 12 seconds.\n4. Double strain through a fine mesh strainer into a chilled coupe.\n5. Float a fresh mint leaf on the surface.",
    source: "21 Club, New York City (c. 1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","gin-forward","herbal","sour","refreshing"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "clover-club",
    name: "Clover Club",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Three fresh raspberries",
    description: "A pre-Prohibition Philadelphia gentlemen’s club signature featuring gin, lemon, raspberry syrup, and an ethereal silky egg white foam.",
    instructions: "1. Combine gin, dry vermouth, lemon juice, raspberry syrup, and egg white in a shaker without ice and dry shake vigorously for 15 seconds to emulsify.\n2. Add ice and shake hard for another 15 seconds to chill.\n3. Fine strain into a chilled coupe.\n4. Garnish with skewered raspberries.",
    source: "Bellevue-Stratford Hotel, Philadelphia (c. 1896)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","gin-forward","silky","sour","berry"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Dry Vermouth" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.75, unit: "oz", name: "Raspberry Syrup" },
      { amount: 0.5, unit: "oz", name: "Egg White" },
    ],
  },
  {
    id: "blood-and-sand",
    name: "Blood and Sand",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Orange peel twist",
    description: "Inspired by Rudolph Valentino’s 1922 bullfighter film, weaving smoky scotch with sweet vermouth, cherry liqueur, and orange juice.",
    instructions: "1. Add Scotch whisky, sweet vermouth, Cherry Heering, and fresh orange juice to a shaker filled with ice.\n2. Shake vigorously for 15 seconds.\n3. Double strain into a chilled coupe.\n4. Express an orange peel twist over the rim.",
    source: "Harry Craddock, The Savoy Cocktail Book (1930)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","whiskey-forward","fruity","equal-parts"],
    specs: [
      { amount: 0.75, unit: "oz", name: "Scotch Whisky" },
      { amount: 0.75, unit: "oz", name: "Sweet Vermouth" },
      { amount: 0.75, unit: "oz", name: "Cherry Heering" },
      { amount: 0.75, unit: "oz", name: "Orange Juice" },
    ],
  },
  {
    id: "rob-roy",
    name: "Rob Roy",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Cocktail cherry or lemon twist",
    description: "The Scottish counterpart to the Manhattan, substituting blended Scotch whisky for rye to yield a smoky, rich, and sophisticated sipper.",
    instructions: "1. Combine Scotch whisky, sweet vermouth, and Angostura bitters in an ice-filled mixing glass.\n2. Stir smoothly for 30 seconds until cold and properly diluted.\n3. Strain into a chilled coupe or cocktail glass.\n4. Garnish with a brandied Luxardo cherry.",
    source: "Waldorf Astoria Hotel, New York (1894)",
    sourceUrl: "",
    notes: "Created to commemorate the premiere of an operetta based on Scottish folk hero Rob Roy MacGregor.",
    riffOfId: "manhattan",
    riffOfName: "Manhattan",
    tags: ["prohibition-era","whiskey-forward","smoky","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Scotch Whisky" },
      { amount: 1, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "white-lady",
    name: "White Lady",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Lemon twist",
    description: "Harry MacElhone’s timeless Parisian classic marrying London dry gin with orange triple sec and fresh lemon under a pillowy foam.",
    instructions: "1. Add gin, Cointreau, lemon juice, and egg white into a shaker.\n2. Dry shake without ice for 10 seconds, then add ice and shake hard until ice-cold.\n3. Fine strain into a chilled coupe.\n4. Garnish with a thin lemon peel.",
    source: "Harry MacElhone, Harry's New York Bar, Paris (1919)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","gin-forward","sour","silky"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Cointreau" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Egg White" },
    ],
  },
  {
    id: "monkey-gland",
    name: "Monkey Gland",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Orange twist",
    description: "An iconic 1920s Paris concoction enlivening gin and orange juice with rich grenadine and an alluring rinse of absinthe.",
    instructions: "1. Rinse a chilled coupe with absinthe and discard the excess.\n2. In an ice-filled shaker, combine gin, fresh orange juice, and real pomegranate grenadine.\n3. Shake hard for 12 seconds.\n4. Strain into the prepared coupe and garnish with an orange twist.",
    source: "Harry MacElhone, Harry's New York Bar, Paris (c. 1920s)",
    sourceUrl: "",
    notes: "Named cheekily after Dr. Serge Voronoff’s eccentric surgical longevity experiments in 1920s Paris.",
    tags: ["prohibition-era","gin-forward","fruity","anise-kissed"],
    specs: [
      { amount: 2, unit: "oz", name: "London Dry Gin" },
      { amount: 1.5, unit: "oz", name: "Orange Juice" },
      { amount: 0.25, unit: "oz", name: "Grenadine" },
      { amount: null, unit: "rinse", name: "Absinthe" },
    ],
  },
  {
    id: "mary-pickford",
    name: "Mary Pickford",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Maraschino cherry",
    description: "Crafted at the Hotel Nacional in Havana during Prohibition for Americas Sweetheart, shaking white rum with pineapple, maraschino, and grenadine.",
    instructions: "1. Combine white rum, fresh pineapple juice, maraschino liqueur, and grenadine in a shaker with ice.\n2. Shake vigorously for 15 seconds.\n3. Double strain into a chilled coupe.\n4. Drop a cocktail cherry into the bottom.",
    source: "Fred Kaufman, Hotel Sevilla-Biltmore, Havana (1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","rum-forward","fruity","silky"],
    specs: [
      { amount: 1.5, unit: "oz", name: "White Rum" },
      { amount: 1.5, unit: "oz", name: "Pineapple Juice" },
      { amount: 1, unit: "barspoon", name: "Maraschino Liqueur" },
      { amount: 1, unit: "barspoon", name: "Grenadine" },
    ],
  },
  {
    id: "scofflaw",
    name: "Scofflaw",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Orange twist",
    description: "Created during American Prohibition at Harry's New York Bar in Paris to salute law-flouting imbibers, pairing rye with dry vermouth, lemon, and grenadine.",
    instructions: "1. Add rye whiskey, dry vermouth, fresh lemon juice, grenadine, and orange bitters to an ice-filled shaker.\n2. Shake hard for 12 seconds.\n3. Fine strain into a chilled coupe.\n4. Garnish with a flamed orange peel.",
    source: "Harry's New York Bar, Paris (1924)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","whiskey-forward","sour","historic"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Rye Whiskey" },
      { amount: 1, unit: "oz", name: "Dry Vermouth" },
      { amount: 0.75, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Grenadine" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "brandy-alexander",
    name: "Brandy Alexander",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Freshly grated nutmeg",
    description: "The indulgent after-dinner classic combining French cognac with dark crème de cacao and heavy cream, crowned with fragrant grated nutmeg.",
    instructions: "1. Combine cognac, crème de cacao, and heavy cream in a cocktail shaker with ice.\n2. Shake with vigor for 15 seconds until completely integrated and ice-cold.\n3. Strain into a chilled coupe.\n4. Grate fresh nutmeg across the silky foam surface.",
    source: "Rector's, New York City (c. 1910s)",
    sourceUrl: "",
    notes: "",
    tags: ["prohibition-era","cognac-forward","creamy","dessert","nightcap"],
    specs: [
      { amount: 1, unit: "oz", name: "Cognac" },
      { amount: 1, unit: "oz", name: "Crème de Cacao" },
      { amount: 1, unit: "oz", name: "Heavy Cream" },
    ],
  },
  {
    id: "ramos-gin-fizz",
    name: "Ramos Gin Fizz",
    glassware: "Highball",
    method: "Shaken",
    garnish: "Orange blossom mist",
    description: "Henry C. Ramos’s legendary New Orleans masterpiece, whipped with cream, egg white, citrus, and orange flower water into an architectural meringue tower.",
    instructions: "1. Add gin, lemon juice, lime juice, simple syrup, heavy cream, egg white, and orange flower water to a shaker.\n2. Dry shake without ice for 30-45 seconds.\n3. Add ice cubes and shake vigorously for 60 seconds until frosty and thick.\n4. Strain into a tall highball glass without ice.\n5. Pour club soda down the center to slowly push the stiff foam crown past the glass rim.",
    source: "Henry C. Ramos, Imperial Cabinet Saloon, New Orleans (1888)",
    sourceUrl: "",
    notes: "Ramos famously employed a chain of 35 shaker boys during Mardi Gras to meet the demand for this 12-minute shake drink.",
    tags: ["prohibition-era","gin-forward","silky","legendary","highball"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 0.75, unit: "oz", name: "Simple Syrup" },
      { amount: 1, unit: "oz", name: "Heavy Cream" },
      { amount: 0.75, unit: "oz", name: "Egg White" },
      { amount: 3, unit: "drops", name: "Orange Flower Water" },
      { amount: 2, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "between-the-sheets",
    name: "Between the Sheets",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Flamed lemon twist",
    description: "A heady variation on the Sidecar marrying equal measures of cognac and white rum with orange triple sec and lemon.",
    instructions: "1. Add cognac, white rum, Cointreau, and fresh lemon juice to a shaker with ice.\n2. Shake hard for 12 seconds until thoroughly chilled.\n3. Fine strain into a chilled coupe.\n4. Flame a lemon peel over the top and discard or float.",
    source: "Harry MacElhone, Harry's New York Bar, Paris (c. 1930)",
    sourceUrl: "",
    notes: "",
    riffOfId: "sidecar",
    riffOfName: "Sidecar",
    tags: ["prohibition-era","cognac-forward","potent","sour"],
    specs: [
      { amount: 1, unit: "oz", name: "Cognac" },
      { amount: 1, unit: "oz", name: "White Rum" },
      { amount: 1, unit: "oz", name: "Cointreau" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
    ],
  },
  {
    id: "casino",
    name: "Casino",
    glassware: "Coupe",
    method: "Shaken",
    garnish: "Maraschino cherry & lemon twist",
    description: "Hugo Ensslin’s crisp Aviation sibling featuring Old Tom gin, maraschino, fresh lemon juice, and orange bitters.",
    instructions: "1. Combine Old Tom gin, maraschino liqueur, fresh lemon juice, and orange bitters in an ice-filled cocktail shaker.\n2. Shake vigorously for 12 seconds.\n3. Strain into a chilled coupe.\n4. Garnish with a maraschino cherry and lemon twist.",
    source: "Hugo Ensslin, Recipes for Mixed Drinks (1916)",
    sourceUrl: "",
    notes: "",
    riffOfId: "aviation",
    riffOfName: "Aviation",
    tags: ["prohibition-era","gin-forward","sour","crisp"],
    specs: [
      { amount: 2, unit: "oz", name: "Old Tom Gin" },
      { amount: 0.25, unit: "oz", name: "Maraschino Liqueur" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 2, unit: "dashes", name: "Orange Bitters" },
    ],
  },
  {
    id: "garibaldi",
    name: "Garibaldi",
    glassware: "Highball",
    method: "Built",
    garnish: "Orange wedge",
    description: "The Italian two-ingredient icon named for general Giuseppe Garibaldi, blending red Campari with high-speed frothed fluffy orange juice.",
    instructions: "1. Fill a tall highball glass with ice.\n2. Pour in Campari.\n3. Juice fresh oranges at high speed in a blender or juicer until thick and frothy.\n4. Pour the aerated orange juice over the Campari.\n5. Garnish with a fresh orange wedge on the rim.",
    source: "Italian Classic / Revived by Dante NYC (c. 1860s / 2015)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","bittersweet","citrus-forward","low-abv","highball"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Campari" },
      { amount: 4, unit: "oz", name: "Orange Juice" },
    ],
  },
  {
    id: "negroni-sbagliato",
    name: "Negroni Sbagliato",
    glassware: "Rocks",
    method: "Built",
    garnish: "Orange wheel",
    description: "A sparkling happy mistake created in Milan when bartender Mirko Stocchetto accidentally grabbed Prosecco instead of gin for a Negroni.",
    instructions: "1. Fill a rocks glass or wine goblet with large ice cubes.\n2. Add Campari and sweet vermouth, then stir briefly.\n3. Top with chilled Prosecco sparkling wine.\n4. Gently stir once from the bottom to integrate without losing carbonation.\n5. Garnish with an orange wheel.",
    source: "Mirko Stocchetto, Bar Basso, Milan (1972)",
    sourceUrl: "",
    notes: "",
    riffOfId: "negroni",
    riffOfName: "Negroni",
    tags: ["aperitivo-amaro","bittersweet","sparkling","effervescent"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Campari" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
      { amount: 1.5, unit: "oz", name: "Sparkling Wine" },
    ],
  },
  {
    id: "cynar-spritz",
    name: "Cynar Spritz",
    glassware: "Rocks",
    method: "Built",
    garnish: "Castelvetrano green olive or orange slice",
    description: "A Venetian favorite trading Aperol for the savory, earthy, and bittersweet botanicals of artichoke-based Cynar amaro.",
    instructions: "1. Fill a wine glass or rocks glass with ice.\n2. Add Cynar and Prosecco.\n3. Top with a splash of sparkling soda water.\n4. Stir gently and garnish with an orange slice or a green olive.",
    source: "Venetian Spritz Tradition",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","bittersweet","herbal","low-abv","sparkling"],
    specs: [
      { amount: 2, unit: "oz", name: "Cynar" },
      { amount: 3, unit: "oz", name: "Sparkling Wine" },
      { amount: 1, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "bicicletta",
    name: "Bicicletta",
    glassware: "Rocks",
    method: "Built",
    garnish: "Lemon wheel",
    description: "The timeless northern Italian cafe refresher named after old men who swerved home on their bicycles after enjoying a couple on sunny afternoons.",
    instructions: "1. Fill a wine glass or rocks glass with ice.\n2. Pour in Campari and crisp dry Italian white wine.\n3. Top with chilled club soda and stir gently.\n4. Garnish with a fresh lemon wheel.",
    source: "Italian Cafe Classic (1930s)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","bittersweet","wine-forward","low-abv","refreshing"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Campari" },
      { amount: 2.5, unit: "oz", name: "Dry White Wine" },
      { amount: 1, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "cardinale",
    name: "Cardinale",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Lemon peel twist",
    description: "Rome’s sleek variation on the Negroni substituting sweet vermouth with bone-dry French vermouth for a crisp, scarlet aperitif.",
    instructions: "1. Combine gin, dry vermouth, and Campari in an ice-filled mixing glass.\n2. Stir smoothly for 30 seconds until cold.\n3. Strain into a chilled coupe or over ice in a rocks glass.\n4. Express lemon peel oils over the surface.",
    source: "Giovanni Raimondo, Hotel Excelsior, Rome (1950)",
    sourceUrl: "",
    notes: "Created for a visiting German cardinal who admired red cocktails matching his papal vestments.",
    riffOfId: "negroni",
    riffOfName: "Negroni",
    tags: ["aperitivo-amaro","gin-forward","bittersweet","crisp"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Dry Vermouth" },
      { amount: 0.75, unit: "oz", name: "Campari" },
    ],
  },
  {
    id: "lucien-gaudin",
    name: "Lucien Gaudin",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Orange twist",
    description: "Named for the legendary 1920s French Olympic fencing champion, bridging the Negroni and White Lady with gin, Campari, Cointreau, and dry vermouth.",
    instructions: "1. Add gin, Campari, Cointreau, and dry vermouth to an ice-filled mixing glass.\n2. Stir for 25-30 seconds until thoroughly chilled and integrated.\n3. Strain into a chilled coupe.\n4. Garnish with an expressed orange twist.",
    source: "French Classic (c. 1920s)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","gin-forward","bittersweet","elegant"],
    specs: [
      { amount: 1.5, unit: "oz", name: "London Dry Gin" },
      { amount: 0.5, unit: "oz", name: "Campari" },
      { amount: 0.5, unit: "oz", name: "Cointreau" },
      { amount: 0.5, unit: "oz", name: "Dry Vermouth" },
    ],
  },
  {
    id: "toronto",
    name: "Toronto",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Orange peel twist",
    description: "David Embury’s refined rye whiskey cocktail utilizing pungent Fernet-Branca as a profound bittering accent balanced with a hint of syrup.",
    instructions: "1. Combine rye whiskey, Fernet-Branca, simple syrup, and Angostura bitters in a mixing glass with ice.\n2. Stir steadily for 30 seconds until cold.\n3. Strain into a chilled coupe.\n4. Express an orange peel over the glass and insert.",
    source: "David Embury, The Fine Art of Mixing Drinks (1948)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","whiskey-forward","bitter","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Rye Whiskey" },
      { amount: 0.25, unit: "oz", name: "Fernet-Branca" },
      { amount: 0.25, unit: "oz", name: "Simple Syrup" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "adonis",
    name: "Adonis",
    glassware: "Nick & Nora",
    method: "Stirred",
    garnish: "Orange twist",
    description: "An elegant low-ABV Victorian classic from Broadway, uniting equal parts rich sweet sherry and sweet vermouth with aromatic orange bitters.",
    instructions: "1. Combine sweet oloroso sherry, sweet vermouth, and orange bitters in an ice-filled mixing glass.\n2. Stir gently for 30 seconds until cold.\n3. Strain into a chilled Nick & Nora glass.\n4. Express orange peel oils over the surface.",
    source: "Hoffman House, New York City (c. 1884)",
    sourceUrl: "",
    notes: "Named to celebrate the record-breaking 500th performance of the Broadway musical Adonis.",
    tags: ["aperitivo-amaro","low-abv","sherry-forward","nutty","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Sweet Sherry" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
      { amount: 2, unit: "dashes", name: "Orange Bitters" },
    ],
  },
  {
    id: "bamboo",
    name: "Bamboo",
    glassware: "Nick & Nora",
    method: "Stirred",
    garnish: "Lemon twist",
    description: "Louis Eppinger’s historic Yokohama masterpiece pairing dry sherry with dry vermouth and bitters for a bone-dry, saline aperitif.",
    instructions: "1. Add fino or manzanilla dry sherry, dry vermouth, and both bitters to a mixing glass filled with ice.\n2. Stir smoothly for 30 seconds.\n3. Strain into a chilled Nick & Nora glass.\n4. Express lemon peel oils across the rim.",
    source: "Louis Eppinger, Grand Hotel, Yokohama (c. 1890s)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","low-abv","sherry-forward","dry","crisp"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Dry Sherry" },
      { amount: 1.5, unit: "oz", name: "Dry Vermouth" },
      { amount: 1, unit: "dash", name: "Angostura Bitters" },
      { amount: 1, unit: "dash", name: "Orange Bitters" },
    ],
  },
  {
    id: "sherry-cobbler",
    name: "Sherry Cobbler",
    glassware: "Highball",
    method: "Built",
    garnish: "Orange wheel, berries & mint sprig",
    description: "The 19th-century sensation that popularized the drinking straw and cocktail shaker, serving dry sherry with sugar and muddled fruit over crushed ice.",
    instructions: "1. In a shaker, muddle orange slices with simple syrup.\n2. Add dry sherry and ice, shake briefly to chill.\n3. Pour unstrained into an Old Fashioned glass or highball packed with crushed ice.\n4. Garnish lavishly with berries, citrus wheels, and a straw.",
    source: "American Classic (c. 1830s)",
    sourceUrl: "",
    notes: "Charles Dickens featured this drink in The Life and Adventures of Martin Chuzzlewit.",
    tags: ["aperitivo-amaro","low-abv","sherry-forward","fruity","crushed-ice"],
    specs: [
      { amount: 3, unit: "oz", name: "Dry Sherry" },
      { amount: 0.5, unit: "oz", name: "Simple Syrup" },
      { amount: 0.5, unit: "oz", name: "Orange Juice" },
    ],
  },
  {
    id: "pimms-cup",
    name: "Pimm's No. 1 Cup",
    glassware: "Highball",
    method: "Built",
    garnish: "Cucumber slice, mint, strawberry & lemon wheel",
    description: "The definitive British summer garden party cup, pairing herbal Pimm's liqueur with effervescent ginger ale and a lush harvest of fresh fruits.",
    instructions: "1. Fill a tall highball glass with ice, sliced cucumber, strawberries, and mint leaves.\n2. Add Pimm's No. 1 and fresh lemon juice.\n3. Top with chilled ginger ale or sparkling lemonade.\n4. Stir gently to integrate all ingredients.",
    source: "James Pimm, London (c. 1840s)",
    sourceUrl: "",
    notes: "The official cocktail of the Wimbledon tennis tournament.",
    tags: ["aperitivo-amaro","low-abv","refreshing","herbal","highball"],
    specs: [
      { amount: 2, unit: "oz", name: "Red Bitter" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 4, unit: "oz", name: "Ginger Ale" },
    ],
  },
  {
    id: "hugo-spritz",
    name: "Hugo Spritz",
    glassware: "Highball",
    method: "Built",
    garnish: "Fresh mint sprig & lime wheel",
    description: "The breezy South Tyrolean alpine spritz that conquered central Europe, uniting elderflower liqueur, sparkling Prosecco, soda, and torn mint.",
    instructions: "1. Add fresh mint leaves and elderflower liqueur to a wine glass and gently press.\n2. Fill the glass with ice cubes.\n3. Pour in chilled Prosecco and a splash of sparkling club soda.\n4. Stir gently from the bottom and garnish with a mint sprig and lime.",
    source: "Roland Gruber, Naturno, South Tyrol (2005)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","low-abv","sparkling","floral","refreshing"],
    specs: [
      { amount: 1.5, unit: "oz", name: "St-Germain" },
      { amount: 3, unit: "oz", name: "Sparkling Wine" },
      { amount: 1, unit: "oz", name: "Club Soda" },
    ],
  },
  {
    id: "blackthorn",
    name: "Blackthorn",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Lemon twist",
    description: "A stately late-19th century Irish whiskey Manhattan variant laced with dry vermouth, Angostura bitters, and a perfume of absinthe.",
    instructions: "1. Add Irish whiskey, dry vermouth, absinthe, and Angostura bitters to a mixing glass filled with ice.\n2. Stir smoothly for 30 seconds.\n3. Strain into a chilled coupe.\n4. Express lemon peel oils over the surface.",
    source: "Savoy Cocktail Book (c. 1890s / 1930)",
    sourceUrl: "",
    notes: "",
    tags: ["aperitivo-amaro","whiskey-forward","herbal","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Irish Whiskey" },
      { amount: 1, unit: "oz", name: "Dry Vermouth" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
      { amount: 2, unit: "drops", name: "Absinthe" },
    ],
  },
  {
    id: "rabo-de-galo",
    name: "Rabo de Galo",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange twist",
    description: "Brazil’s beloved bittersweet everyday classic, marrying fiery sugarcane cachaça with sweet Italian vermouth and herbal amaro.",
    instructions: "1. Combine cachaça, sweet vermouth, and Cynar in a rocks glass with ice.\n2. Stir steadily for 20 seconds.\n3. Express an orange twist over the glass and insert.",
    source: "Brazilian Classic (c. 1950s)",
    sourceUrl: "",
    notes: "Literally translates to \"Tail of the Rooster\" (cock-tail).",
    tags: ["aperitivo-amaro","cachaca-forward","bittersweet","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Cachaça" },
      { amount: 0.75, unit: "oz", name: "Sweet Vermouth" },
      { amount: 0.75, unit: "oz", name: "Cynar" },
    ],
  },
  {
    id: "mi-to",
    name: "Milano-Torino (Mi-To)",
    glassware: "Rocks",
    method: "Built",
    garnish: "Orange slice",
    description: "The venerable 1860s foundation of the entire Negroni dynasty, marrying Milan’s bitter red Campari with Turin’s sweet vermouth.",
    instructions: "1. Fill a rocks glass with ice cubes.\n2. Add equal measures of Campari and sweet vermouth.\n3. Stir gently for 15 seconds to chill and integrate.\n4. Garnish with a fresh orange slice.",
    source: "Gaspare Campari, Caffè Camparino, Milan (c. 1860s)",
    sourceUrl: "",
    notes: "The direct ancestor of both the Americano (added soda) and the Negroni (added gin).",
    tags: ["aperitivo-amaro","bittersweet","ancestor","low-abv","equal-parts"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Campari" },
      { amount: 1.5, unit: "oz", name: "Sweet Vermouth" },
    ],
  },
  {
    id: "vesper",
    name: "Vesper",
    glassware: "Martini",
    method: "Shaken",
    garnish: "Large thin slice of lemon peel",
    description: "James Bond’s iconic creation from Casino Royale: three measures of Gordon’s gin, one of vodka, half of Kina Lillet, shaken until ice-cold.",
    instructions: "1. Add London dry gin, vodka, and Lillet Blanc into a cocktail shaker packed with ice.\n2. Shake violently until ice chips form on the surface.\n3. Strain into a chilled deep goblet or martini glass.\n4. Garnish with a long, thin lemon peel spiral.",
    source: "Ian Fleming, Casino Royale (1953)",
    sourceUrl: "",
    notes: "Named for double agent Vesper Lynd because once you have tasted it, you won't want to drink anything else.",
    tags: ["nightcaps","gin-forward","vodka-forward","potent","crisp"],
    specs: [
      { amount: 2.25, unit: "oz", name: "London Dry Gin" },
      { amount: 0.75, unit: "oz", name: "Vodka" },
      { amount: 0.5, unit: "oz", name: "Lillet Blanc" },
    ],
  },
  {
    id: "rusty-nail",
    name: "Rusty Nail",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Lemon twist",
    description: "The Rat Pack favorite uniting smoky Scotch whisky with honeyed, heather-scented Drambuie herbal liqueur over a single rock.",
    instructions: "1. Fill an Old Fashioned glass with a single large ice cube.\n2. Pour in Scotch whisky and Drambuie.\n3. Stir gently for 20 seconds.\n4. Express a twist of lemon over the glass and drop it in.",
    source: "21 Club, New York City (c. 1960s)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","whiskey-forward","sweet","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Scotch Whisky" },
      { amount: 0.75, unit: "oz", name: "Drambuie" },
    ],
  },
  {
    id: "godfather",
    name: "Godfather",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange twist",
    description: "A smooth 1970s staple pairing peaty Scotch whisky with the rich toasted almond sweetness of Italian amaretto.",
    instructions: "1. Add Scotch whisky and amaretto into an Old Fashioned glass with ice cubes.\n2. Stir slowly for 20 seconds to blend.\n3. Express an orange peel over the glass and drop it in.",
    source: "1970s Classic (named after the film The Godfather)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","whiskey-forward","sweet","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Scotch Whisky" },
      { amount: 0.75, unit: "oz", name: "Amaretto" },
    ],
  },
  {
    id: "white-russian",
    name: "White Russian",
    glassware: "Rocks",
    method: "Built",
    garnish: "No garnish or whole coffee bean",
    description: "The decadent after-dinner drink elevated to pop-culture immortality by The Big Lebowski, layering rich cream over vodka and coffee liqueur.",
    instructions: "1. Fill an Old Fashioned glass with fresh ice cubes.\n2. Pour in vodka and coffee liqueur and stir briefly.\n3. Gently float heavy cream or whole milk over the back of a barspoon.\n4. Stir before drinking or sip layered.",
    source: "1960s Classic",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","creamy","coffee","dessert"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Vodka" },
      { amount: 1, unit: "oz", name: "Coffee Liqueur" },
      { amount: 1, unit: "oz", name: "Heavy Cream" },
    ],
  },
  {
    id: "black-russian",
    name: "Black Russian",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Maraschino cherry",
    description: "Created for the American ambassador to Luxembourg, matching neutral crisp vodka with dark bittersweet Mexican coffee liqueur.",
    instructions: "1. Add vodka and coffee liqueur into an Old Fashioned glass filled with ice.\n2. Stir well for 20 seconds to dilute and chill.\n3. Garnish with a cocktail cherry.",
    source: "Gustave Tops, Hotel Métropole, Brussels (1949)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","vodka-forward","coffee","slow-sipper"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Vodka" },
      { amount: 0.75, unit: "oz", name: "Coffee Liqueur" },
    ],
  },
  {
    id: "el-diablo",
    name: "El Diablo",
    glassware: "Highball",
    method: "Built",
    garnish: "Lime wedge & blackberry",
    description: "Trader Vic’s dazzling highball cascading dark blackcurrant cassis over reposado tequila, fresh lime, and spicy effervescent ginger beer.",
    instructions: "1. Combine reposado tequila and fresh lime juice in a shaker with ice and shake briefly.\n2. Strain into a tall highball glass filled with ice.\n3. Top with spicy ginger beer.\n4. Carefully float Crème de Cassis over the top to create a rich crimson halo.\n5. Garnish with a lime wedge.",
    source: "Victor \"Trader Vic\" Bergeron (1946)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","agave-forward","highball","spicy","refreshing"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Reposado Tequila" },
      { amount: 0.5, unit: "oz", name: "Crème de Cassis" },
      { amount: 0.5, unit: "oz", name: "Fresh Lime Juice" },
      { amount: 3, unit: "oz", name: "Ginger Beer" },
    ],
  },
  {
    id: "japanese-cocktail",
    name: "Japanese Cocktail",
    glassware: "Coupe",
    method: "Stirred",
    garnish: "Lemon peel twist",
    description: "Jerry Thomas’s historic 1862 creation marrying velvety French cognac with aromatic orgeat syrup and heavy dashes of Angostura bitters.",
    instructions: "1. Add cognac, orgeat, and Angostura bitters to a mixing glass filled with ice.\n2. Stir smoothly for 30 seconds.\n3. Strain into a chilled coupe.\n4. Express a lemon twist over the drink and drop it in.",
    source: "Jerry Thomas, How to Mix Drinks (1862)",
    sourceUrl: "",
    notes: "Created to honor the first Japanese diplomatic mission to the United States in 1860.",
    tags: ["nightcaps","cognac-forward","nutty","historic","slow-sipper"],
    specs: [
      { amount: 2, unit: "oz", name: "Cognac" },
      { amount: 0.5, unit: "oz", name: "Orgeat" },
      { amount: 2, unit: "dashes", name: "Angostura Bitters" },
    ],
  },
  {
    id: "french-connection",
    name: "French Connection",
    glassware: "Rocks",
    method: "Stirred",
    garnish: "Orange twist",
    description: "An alluring 1970s two-ingredient digestif pairing rich warming French cognac with sweet Italian amaretto liqueur.",
    instructions: "1. Combine equal parts cognac and amaretto in an Old Fashioned glass with a large ice cube.\n2. Stir gently for 20 seconds.\n3. Express an orange twist over the glass and insert.",
    source: "1970s Classic (named after the Gene Hackman film)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","cognac-forward","sweet","equal-parts","nightcap"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Cognac" },
      { amount: 1.5, unit: "oz", name: "Amaretto" },
    ],
  },
  {
    id: "brandy-milk-punch",
    name: "Brandy Milk Punch",
    glassware: "Rocks",
    method: "Shaken",
    garnish: "Freshly grated nutmeg",
    description: "New Orleans’s festive brunch and holiday staple blending rich brandy and bourbon with whole milk, vanilla sweetness, and fresh nutmeg.",
    instructions: "1. Add cognac or bourbon, whole milk or cream, simple syrup, and a drop of vanilla extract into a shaker with cracked ice.\n2. Shake hard for 20 seconds until well chilled and foamy.\n3. Strain into an Old Fashioned glass filled with fresh ice.\n4. Dust generously with fresh grated nutmeg.",
    source: "Brennan's, New Orleans (Traditional Creole Classic)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","cognac-forward","creamy","historic","brunch"],
    specs: [
      { amount: 2, unit: "oz", name: "Cognac" },
      { amount: 3, unit: "oz", name: "Milk" },
      { amount: 0.5, unit: "oz", name: "Simple Syrup" },
    ],
  },
  {
    id: "bloody-mary",
    name: "Bloody Mary",
    glassware: "Highball",
    method: "Built",
    garnish: "Celery stalk, lemon wedge & green olive",
    description: "The legendary savory brunch restorative balancing crisp vodka with seasoned tomato juice, lemon, Worcestershire, hot sauce, and celery salt.",
    instructions: "1. Roll (pour back and forth between two shaker tins with ice) vodka, tomato juice, lemon juice, Worcestershire sauce, hot sauce, black pepper, and celery salt.\n2. Strain into a tall highball glass filled with ice.\n3. Garnish with a tall leafy celery stalk, lemon wedge, and an olive.",
    source: "Fernand Petiot, Harry's New York Bar, Paris (1921)",
    sourceUrl: "",
    notes: "",
    tags: ["nightcaps","vodka-forward","savory","brunch","highball"],
    specs: [
      { amount: 1.5, unit: "oz", name: "Vodka" },
      { amount: 4, unit: "oz", name: "Tomato Juice" },
      { amount: 0.5, unit: "oz", name: "Fresh Lemon Juice" },
      { amount: 2, unit: "dashes", name: "Worcestershire Sauce" },
      { amount: 2, unit: "drops", name: "Hot Sauce" },
      { amount: 1, unit: "dash", name: "Celery Salt" },
    ],
  },
];

export function getRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
      return SEED_RECIPES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let updatedStorage = false;

      // Automatically backfill any canonical seed recipes missing from stored list
      SEED_RECIPES.forEach(seedRecipe => {
        const exists = parsed.some(r => r.id === seedRecipe.id);
        if (!exists) {
          parsed.push({ ...seedRecipe });
          updatedStorage = true;
        }
      });

      parsed.forEach(r => {
        const seed = SEED_RECIPES.find(s => s.id === r.id);
        if (seed) {
          // Clear duplicate notes on recipes that now have dedicated step instructions
          if ((r.id === 'old-fashioned' || r.id === 'negroni') && r.notes) {
            r.notes = '';
            updatedStorage = true;
          }
          // Backfill all properties from seed that might be missing in older stored versions
          Object.keys(seed).forEach(key => {
            if (r[key] === undefined || r[key] === null || r[key] === '') {
              r[key] = Array.isArray(seed[key]) ? [...seed[key]] : seed[key];
              updatedStorage = true;
            } else if (Array.isArray(seed[key]) && (!Array.isArray(r[key]) || r[key].length === 0)) {
              r[key] = [...seed[key]];
              updatedStorage = true;
            }
          });
          // Merge pack tags into existing stored tags if missing
          if (Array.isArray(seed.tags) && Array.isArray(r.tags)) {
            seed.tags.forEach(t => {
              if (!r.tags.includes(t)) {
                r.tags.push(t);
                updatedStorage = true;
              }
            });
          }
        } else if (!Array.isArray(r.tags)) {
          r.tags = [];
          updatedStorage = true;
        }
      });

      // Migrate legacy random IDs (rec_... / recipe-...) to clean, consistent slugs
      const existingIds = new Set(parsed.map(r => r.id));
      parsed.forEach(r => {
        if (r.id && (r.id.startsWith('rec_') || r.id.startsWith('recipe-'))) {
          existingIds.delete(r.id);
          const newSlug = slugifyRecipeName(r.name, existingIds);
          existingIds.add(newSlug);

          if (typeof window !== 'undefined' && window.location && window.location.hash === `#${r.id}`) {
            history.replaceState(null, '', `#${newSlug}`);
          }
          if (typeof localStorage !== 'undefined') {
            try {
              const lastActive = localStorage.getItem('speakeasy_last_active_recipe');
              if (lastActive === r.id) {
                localStorage.setItem('speakeasy_last_active_recipe', newSlug);
              }
            } catch {
              // Ignore
            }
          }
          r.id = newSlug;
          updatedStorage = true;
        }
      });

      if (updatedStorage) {
        saveRecipes(parsed);
      }
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECIPES));
    return SEED_RECIPES;
  } catch (err) {
    console.error('Failed to read recipes from localStorage:', err);
    return SEED_RECIPES;
  }
}

/**
 * Creates a clean, URL-safe slug from a cocktail name (e.g. "Scotch Old Fashioned" -> "scotch-old-fashioned")
 */
export function slugifyRecipeName(name, existingIds = new Set()) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'cocktail';

  let slug = base;
  let counter = 2;
  while (existingIds.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

export function saveRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (err) {
    console.error('Failed to save recipes to localStorage:', err);
  }
}

export function saveRecipe(recipe) {
  const recipes = getRecipes();
  const existingIds = new Set(recipes.map(r => r.id));
  if (recipe.id) {
    existingIds.delete(recipe.id);
  }
  const id = recipe.id || slugifyRecipeName(recipe.name, existingIds);
  const tags = Array.isArray(recipe.tags)
    ? Array.from(new Set(recipe.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
    : [];
  const updatedRecipe = { ...recipe, id, tags };

  const existingIndex = recipes.findIndex(r => r.id === id);
  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...recipes];
    updatedList[existingIndex] = updatedRecipe;
  } else {
    updatedList = [updatedRecipe, ...recipes];
  }

  saveRecipes(updatedList);
  return updatedRecipe;
}

export function deleteRecipe(id) {
  const recipes = getRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  saveRecipes(filtered);
  return filtered;
}

export function exportRecipesJSON() {
  const recipes = getRecipes();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(recipes, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `speakeasy_recipes_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importRecipesJSON(jsonString, mode = 'merge') {
  let imported;
  try {
    imported = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format');
  }

  if (!Array.isArray(imported)) {
    throw new Error('Imported JSON must be an array of recipe objects');
  }

  // Sanitize and validate recipes
  const validRecipes = imported.filter(item => {
    return item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim().length > 0;
  }).map(item => ({
    id: item.id || slugifyRecipeName(item.name),
    name: item.name.trim(),
    glassware: item.glassware || 'Rocks',
    method: item.method || 'Stirred',
    garnish: item.garnish || '',
    description: item.description || '',
    instructions: item.instructions || item.notes || '',
    source: item.source || '',
    sourceUrl: item.sourceUrl || '',
    notes: item.notes || '',
    riffOfId: item.riffOfId || null,
    riffOfName: item.riffOfName || '',
    tags: Array.isArray(item.tags)
      ? Array.from(new Set(item.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
      : [],
    specs: Array.isArray(item.specs) ? item.specs.map(s => ({
      amount: s.amount !== null && s.amount !== undefined && !isNaN(Number(s.amount)) ? Number(s.amount) : null,
      unit: s.unit || '',
      name: s.name || '',
      abv: s.abv !== null && s.abv !== undefined && !isNaN(Number(s.abv)) ? Number(s.abv) : undefined,
    })) : [],
  }));

  if (validRecipes.length === 0) {
    throw new Error('No valid recipes found in imported file');
  }

  const existing = getRecipes();
  let merged;
  if (mode === 'replace') {
    merged = validRecipes;
  } else {
    // Merge: update existing by ID or add new
    const map = new Map(existing.map(r => [r.id, r]));
    validRecipes.forEach(r => map.set(r.id, r));
    merged = Array.from(map.values());
  }

  saveRecipes(merged);
  return merged;
}

export function getAllUniqueTags(recipes = []) {
  const tagSet = new Set();
  (recipes || []).forEach(recipe => {
    if (Array.isArray(recipe.tags)) {
      recipe.tags.forEach(tag => {
        const clean = String(tag || '').trim().toLowerCase();
        if (clean) tagSet.add(clean);
      });
    }
  });
  return Array.from(tagSet).sort();
}

export function resetToDefaults() {
  saveRecipes(SEED_RECIPES);
  return SEED_RECIPES;
}

// ==========================================
// Backbar Personal Inventory Persistence
// ==========================================
const INVENTORY_STORAGE_KEY = 'speakeasy_inventory';

export const DEFAULT_STARTER_BAR = [
  'bourbon',
  'rye_whiskey',
  'london_dry_gin',
  'light_rum',
  'tequila_blanco',
  'sweet_vermouth',
  'dry_vermouth',
  'red_bitter',
  'triple_sec',
  'simple_syrup',
  'aromatic_bitters',
  'lemon_juice',
  'lime_juice',
];

export function getInventory() {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read inventory from localStorage:', err);
    return [];
  }
}

export function saveInventory(ids) {
  try {
    const list = Array.from(new Set(ids));
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.error('Failed to save inventory to localStorage:', err);
    return ids;
  }
}

export function toggleInventoryItem(id) {
  const current = new Set(getInventory());
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  const updated = Array.from(current);
  saveInventory(updated);
  return updated;
}

export function clearInventory() {
  saveInventory([]);
  return [];
}

// ==========================================
// User Preferences & Bar Profile
// ==========================================
const UNIT_STORAGE_KEY = 'speakeasy_unit_system';
const BAR_NAME_STORAGE_KEY = 'speakeasy_bar_name';

export function getUnitPreference() {
  try {
    const val = localStorage.getItem(UNIT_STORAGE_KEY);
    return val === 'ml' ? 'ml' : 'oz';
  } catch {
    return 'oz';
  }
}

export function saveUnitPreference(unit) {
  try {
    const clean = unit === 'ml' ? 'ml' : 'oz';
    localStorage.setItem(UNIT_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save unit preference:', err);
    return unit;
  }
}

export function getBarName() {
  try {
    const val = localStorage.getItem(BAR_NAME_STORAGE_KEY);
    return val && val.trim() ? val.trim() : 'Speakeasy Vault';
  } catch {
    return 'Speakeasy Vault';
  }
}

export function saveBarName(name) {
  try {
    const clean = (name || '').trim() || 'Speakeasy Vault';
    localStorage.setItem(BAR_NAME_STORAGE_KEY, clean);
    return clean;
  } catch (err) {
    console.error('Failed to save bar name:', err);
    return name;
  }
}

