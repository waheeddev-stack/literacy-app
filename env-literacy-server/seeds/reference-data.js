// Starter content. Educators should review and extend it via the Question Bank (PRD risk: question quality).
export const TOPICS = [
  ['waste', 'Waste'], ['water', 'Water'], ['energy', 'Energy'], ['biodiversity', 'Biodiversity'],
  ['climate', 'Climate'], ['air-quality', 'Air quality'], ['transport', 'Transport'], ['local-issues', 'Local issues'],
];

// [topic, grade_band, difficulty 1-5, text, [options], correctIndex, explanation]
export const QUESTIONS = [
  ['waste', '6-8', 1, 'Which bin is meant for vegetable peels and leftover food?', ['Green bin (wet waste)', 'Blue bin (dry waste)', 'Red bin (hazardous waste)', 'Any bin will do'], 0, 'Green is commonly used for wet, biodegradable waste, blue for dry waste and red for hazardous or sanitary waste.'],
  ['waste', '6-8', 1, 'What happens when paper is recycled?', ['It is burnt for heat', 'It is turned into new paper products', 'It is buried', 'It is thrown into the sea'], 1, 'Recycling turns used materials into new products, saving trees and energy.'],
  ['waste', '9-10', 2, "India's Solid Waste Management Rules, 2016 require waste to be separated at source into how many basic streams?", ['Two', 'Three', 'Five', 'Seven'], 1, 'Three streams: biodegradable (wet), dry, and domestic hazardous waste.'],
  ['waste', '11-12', 3, 'Which action sits highest on the waste hierarchy (most preferred)?', ['Recycling', 'Landfilling', 'Preventing or reducing waste', 'Burning for energy'], 2, 'The hierarchy is: prevent/reduce, reuse, recycle, recover, and finally dispose.'],
  ['waste', 'undergrad', 3, 'Composting wet waste instead of landfilling it mainly reduces which problem?', ['Methane emissions from rotting organic waste', 'Glass build-up', 'Noise pollution', 'Radioactive waste'], 0, 'Organic waste rotting without oxygen in landfills releases methane, a powerful greenhouse gas.'],
  ['waste', 'postgrad', 4, 'Extended Producer Responsibility (EPR) for plastic packaging makes which party responsible for collecting and recycling packaging waste?', ['Consumers only', 'Producers, importers and brand owners', 'Ward councillors only', 'Waste pickers only'], 1, 'EPR shifts end-of-life responsibility to those who put the packaging on the market.'],

  ['water', '6-8', 1, 'Which habit saves the most water?', ['Leaving the tap running while brushing', 'Turning the tap off while brushing', 'Washing a car with a hose daily', 'Taking very long showers'], 1, 'A running tap can waste several litres a minute.'],
  ['water', '6-8', 1, 'Rainwater harvesting means:', ['Collecting and storing rainwater for later use', 'Draining rain into sewers', 'Making rain with machines', 'Boiling rainwater'], 0, 'Harvested rain can recharge groundwater or be stored for gardens and cleaning.'],
  ['water', '9-10', 2, 'How much of the water on Earth is easily accessible fresh water?', ['Most of it', 'About half', 'Well under one percent', 'Exactly one quarter'], 2, 'Most water is salty or locked in ice, so usable fresh water is very scarce.'],
  ['water', '11-12', 3, 'After basic treatment, greywater from sinks and showers can safely be reused for:', ['Drinking', 'Cooking', 'Flushing toilets and gardening', 'Filling baby bottles'], 2, 'Greywater suits non-drinking uses such as flushing and irrigation.'],
  ['water', 'undergrad', 3, 'Pumping out groundwater faster than it is recharged is called:', ['Groundwater over-extraction', 'Eutrophication', 'Desalination', 'Siltation'], 0, 'Over-extraction lowers water tables and can dry up wells and cause saltwater intrusion near the coast.'],
  ['water', 'postgrad', 4, 'Eutrophication of a lake is mainly caused by excess:', ['Nutrients such as nitrogen and phosphorus', 'Salt', 'Sunlight', 'Oxygen'], 0, 'Nutrient runoff feeds algal blooms that later deplete oxygen and kill aquatic life.'],

  ['energy', '6-8', 1, 'Which of these is a renewable source of energy?', ['Coal', 'Solar', 'Petrol', 'Natural gas'], 1, 'Solar energy comes from the sun and does not run out.'],
  ['energy', '6-8', 1, 'What should you do with lights and fans when you leave a room?', ['Leave them on for the next person', 'Switch them off', 'Only switch off the light', 'Ask someone else to do it'], 1, 'Switching off unused appliances saves electricity and money.'],
  ['energy', '9-10', 2, 'A BEE 5-star label on an appliance means it is:', ['The most expensive', 'The most energy-efficient in its category', 'Made abroad', 'The quietest'], 1, 'The Bureau of Energy Efficiency star rating compares energy use within a product category.'],
  ['energy', '11-12', 2, 'Which bulb gives the same brightness with the least electricity?', ['Incandescent', 'Halogen', 'LED', 'CFL'], 2, 'LEDs use far less electricity than incandescent bulbs and last much longer.'],
  ['energy', 'undergrad', 3, 'Net metering for rooftop solar allows a consumer to:', ['Export surplus power to the grid and offset their bill', 'Store power in the grid forever', 'Avoid all taxes', 'Generate power at night'], 0, 'Net metering credits the electricity you feed into the grid against what you draw.'],
  ['energy', 'postgrad', 4, "A power plant's capacity factor is:", ['Actual output over a period divided by the maximum possible output', 'Its height', 'The number of staff', 'Price per unit'], 0, 'Solar and wind have lower capacity factors than baseload plants because of variable resources.'],

  ['biodiversity', '6-8', 1, 'Why are bees important to people?', ['They pollinate many food crops', 'They make electricity', 'They clean rivers', 'They produce plastic'], 0, 'Pollinators help produce fruits, vegetables and seeds.'],
  ['biodiversity', '6-8', 1, 'Planting native trees is better than exotic ones because native trees:', ['Support local birds and insects', 'Always grow taller', 'Need more water', 'Never need care'], 0, 'Native species fit the local food web and climate.'],
  ['biodiversity', '9-10', 2, 'A habitat is:', ['The place where an organism naturally lives', 'A type of food', 'A kind of weather', 'A farming tool'], 0, 'A habitat provides food, water, shelter and space.'],
  ['biodiversity', '11-12', 3, 'What is the biggest driver of species loss worldwide?', ['Habitat destruction', 'Moonlight', 'Seasonal rain', 'Volcanoes'], 0, 'Land conversion, pollution and over-harvesting outweigh natural causes.'],
  ['biodiversity', 'undergrad', 3, 'Mangroves protect coasts mainly by:', ['Reducing wave energy and trapping sediment', 'Producing salt', 'Blocking sunlight', 'Attracting tourists'], 0, 'Their dense roots slow waves, trap silt and shelter young fish.'],
  ['biodiversity', 'postgrad', 4, 'Which measure combines species richness and relative abundance in a community?', ['Shannon diversity index', 'Richter scale', 'Gini coefficient', 'pH'], 0, 'The Shannon index is widely used to quantify biodiversity.'],

  ['climate', '6-8', 1, 'Which gas is the main driver of human-caused global warming?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], 1, 'Burning fossil fuels releases carbon dioxide, which traps heat.'],
  ['climate', '6-8', 1, 'Planting trees helps the climate because trees:', ['Absorb carbon dioxide', 'Make the sun hotter', 'Stop all rain', 'Release more carbon dioxide than they take in'], 0, 'Growing trees store carbon in wood and soil.'],
  ['climate', '9-10', 2, 'The greenhouse effect is:', ['Heat trapped by gases in the atmosphere', 'Plants grown under glass', 'The hole in the ozone layer', 'Cold air from glaciers'], 0, 'A natural greenhouse effect keeps Earth warm; extra gases strengthen it.'],
  ['climate', '11-12', 3, 'The Paris Agreement aims to hold global warming well below:', ['1 °C', '2 °C above pre-industrial levels', '5 °C', '10 °C'], 1, 'Countries also pursue efforts to limit the rise to 1.5 °C.'],
  ['climate', 'undergrad', 3, 'Which is a climate ADAPTATION measure for a coastal city?', ['Restoring mangrove buffers and building sea walls', 'Switching to solar power', 'Planting forests elsewhere', 'Running electric buses'], 0, 'Adaptation reduces harm from changes already happening; mitigation cuts emissions.'],
  ['climate', 'postgrad', 4, "An institution's Scope 2 emissions come from:", ['Purchased electricity, heating and cooling', 'Its own vehicles', 'Suppliers\' travel', 'Staff commuting'], 0, 'Scope 1 is direct emissions, Scope 2 is purchased energy, Scope 3 is the wider value chain.'],

  ['air-quality', '6-8', 1, 'Burning garbage in the open causes:', ['Harmful smoke and air pollution', 'Cleaner air', 'More oxygen', 'Rain'], 0, 'Open burning releases toxic gases and fine particles.'],
  ['air-quality', '6-8', 1, 'What helps reduce dust and smoke near a school?', ['More trees and no open burning', 'Burning dry leaves', 'More idling vehicles', 'Cutting plants'], 0, 'Plants trap dust, and avoiding burning keeps smoke out of the air.'],
  ['air-quality', '9-10', 2, 'PM2.5 refers to:', ['Particles smaller than 2.5 micrometres that reach deep into lungs', 'A type of pollen', 'A harmless gas', 'A cloud type'], 0, 'Fine particles are linked to breathing and heart problems.'],
  ['air-quality', '11-12', 2, "In India's Air Quality Index, which category is the worst?", ['Moderate', 'Poor', 'Very Poor', 'Severe'], 3, 'Categories run Good, Satisfactory, Moderate, Poor, Very Poor and Severe.'],
  ['air-quality', 'undergrad', 3, 'Ground-level ozone forms when:', ['Sunlight reacts with nitrogen oxides and volatile organic compounds', 'Plants release oxygen', 'Ice melts', 'Rain falls on soil'], 0, 'It is a secondary pollutant that peaks on sunny, hot days.'],
  ['air-quality', 'postgrad', 4, 'A temperature inversion worsens smog because it:', ['Traps pollutants near the ground', 'Increases wind speed', 'Cleans the air', 'Causes heavy rain'], 0, 'Warm air above cool air acts as a lid, so pollutants cannot disperse.'],

  ['transport', '6-8', 1, 'Which way of getting to school causes the least pollution per person?', ['Walking or cycling', 'A car with one child', 'A two-wheeler', 'A taxi'], 0, 'Walking and cycling produce no tailpipe emissions.'],
  ['transport', '6-8', 1, 'Why is carpooling good for the environment?', ['Fewer vehicles use less fuel', 'It adds traffic', 'It makes more noise', 'It uses more petrol'], 0, 'Sharing a ride cuts fuel use and congestion per person.'],
  ['transport', '9-10', 2, 'Per passenger-kilometre, which usually emits the least CO2?', ['Train or metro', 'Petrol car with one person', 'Domestic flight', 'Diesel SUV'], 0, 'Rail carries many people efficiently.'],
  ['transport', '11-12', 3, 'An electric vehicle has a low carbon footprint mainly when it is:', ['Charged with low-carbon electricity', 'Painted green', 'Larger than petrol cars', 'Used only on weekends'], 0, 'Its emissions depend on how the electricity is generated.'],
  ['transport', 'undergrad', 3, "'Last-mile connectivity' in public transport means:", ['Linking stations to final destinations by walking, cycling or shuttles', 'The last bus of the night', 'A road one mile long', 'Fuel for the final mile'], 0, 'Good last-mile links make public transport a practical choice.'],
  ['transport', 'postgrad', 4, 'Transit-oriented development aims to:', ['Concentrate homes and jobs near public transport to cut car trips', 'Build more parking', 'Widen highways only', 'Ban walking'], 0, 'Compact, mixed-use areas near stations reduce travel demand.'],

  ['local-issues', '6-8', 1, 'The mangroves along Vasai Creek are important because they:', ['Protect the coast and shelter fish and birds', 'Make the sea salty', 'Stop trains', 'Produce plastic'], 0, 'Mangroves are nurseries for fish and a natural coastal defence.'],
  ['local-issues', '6-8', 1, "What helps keep Bhayandar's creeks and drains clean?", ['Never dumping waste or plastic in them', 'Throwing waste in the nala', 'Burning waste next to the creek', 'Washing vehicles in the creek'], 0, 'Waste in drains blocks flow, floods streets and ends up in the creek.'],
  ['local-issues', '9-10', 2, 'Wetlands and mangroves near Bhayandar are important habitats for:', ['Resident and migratory waterbirds', 'Penguins', 'Polar bears', 'Camels'], 0, 'Coastal wetlands feed and shelter many bird species.'],
  ['local-issues', '11-12', 3, 'Clearing mangroves for construction raises which local risk?', ['Coastal flooding and erosion', 'Snowfall', 'Earthquakes', 'Drought'], 0, 'Without mangroves, storm surges and high tides reach settlements more easily.'],
  ['local-issues', 'undergrad', 3, "Maharashtra's Coastal Regulation Zone (CRZ) rules mainly restrict:", ['Construction and activities near the coast and creeks to protect ecosystems', 'Bus routes', 'School timings', 'Fishing licences only'], 0, 'CRZ rules protect coastal ecosystems and communities.'],
  ['local-issues', 'postgrad', 4, 'A wetland provides which ecosystem service to a city like Mira-Bhayandar?', ['Flood buffering and water filtration', 'Printing money', 'Making electricity from rock', 'Blocking radio signals'], 0, 'Wetlands absorb floodwater and filter pollutants.'],
];

// [topic, prompt, scale, grade_band]
export const PRACTICE_ITEMS = [
  ['waste', 'How often this week did you separate wet and dry waste?', 'freq_0_4', 'all'],
  ['waste', 'How often did you carry your own bag or bottle instead of using single-use plastic?', 'freq_0_4', 'all'],
  ['waste', 'Did you compost, reuse or recycle something this week (paper, bottles, food scraps)?', 'yes_no', 'all'],
  ['water', 'How often did you turn off the tap while brushing, washing or soaping?', 'freq_0_4', 'all'],
  ['water', 'Did you report or fix a dripping tap or leak this week?', 'yes_no', 'all'],
  ['water', 'How often did you reuse water, for example for plants or cleaning?', 'freq_0_4', 'all'],
  ['energy', 'How often did you switch off lights and fans when leaving a room?', 'freq_0_4', 'all'],
  ['energy', 'Did you unplug chargers or switch off devices instead of leaving them on standby?', 'yes_no', 'all'],
  ['energy', 'How often did you use daylight or fresh air instead of lights or AC?', 'freq_0_4', 'all'],
  ['biodiversity', 'Did you water, plant or care for a plant or tree this week?', 'yes_no', 'all'],
  ['biodiversity', 'Did you spend time observing nature or put out water or food for birds?', 'yes_no', 'all'],
  ['biodiversity', 'Did you take part in a clean-up, plantation or eco-club activity this week?', 'yes_no', 'all'],
  ['climate', 'How often did you talk with family or friends about saving energy or climate action?', 'freq_0_4', 'all'],
  ['climate', 'How often did you avoid wasting food?', 'freq_0_4', 'all'],
  ['climate', 'Did you choose local or seasonal food at least once this week?', 'yes_no', 'all'],
  ['air-quality', 'Did you avoid burning garbage, leaves or plastic this week?', 'yes_no', 'all'],
  ['air-quality', 'How often did you ask others to switch off engines while waiting?', 'freq_0_4', 'all'],
  ['air-quality', 'Was your home or classroom well ventilated and smoke-free this week?', 'yes_no', 'all'],
  ['transport', 'How often did you walk, cycle or use public transport for your trips?', 'freq_0_4', 'all'],
  ['transport', 'Did you share a ride or use a school or college bus instead of a private vehicle?', 'yes_no', 'all'],
  ['transport', 'How often did you combine errands or skip an unnecessary trip by vehicle?', 'freq_0_4', 'all'],
  ['transport', 'Did you walk or cycle to school at least once this week?', 'yes_no', 'school'],
  ['transport', 'Did you use public transport to reach college at least once this week?', 'yes_no', 'college'],
  ['local-issues', 'Did you keep drains, creeks or open spaces near you free of waste?', 'yes_no', 'all'],
  ['local-issues', 'Did you learn about or discuss a local issue (mangroves, creeks, wetlands) this week?', 'yes_no', 'all'],
  ['local-issues', 'How often did you tell others not to litter or dump waste near water bodies?', 'freq_0_4', 'all'],
];

export const AUDIT_ITEMS = [
  ['Waste', 'Segregation bins (wet, dry, hazardous) placed and used across the campus'],
  ['Waste', 'On-campus composting of organic waste'],
  ['Waste', 'E-waste collected and handed to an authorised recycler'],
  ['Waste', 'Single-use plastic policy in place and enforced'],
  ['Water', 'Rainwater harvesting system installed and working'],
  ['Water', 'Leak checks, water-saving fixtures and drinking-water refill points'],
  ['Energy', 'Solar or other renewable energy installed'],
  ['Energy', 'Energy-efficient (LED) lighting and a switch-off practice'],
  ['Green cover', 'Trees, gardens and open green space on campus'],
  ['Engagement', 'Active eco-club with regular environmental events'],
];

// [topic, knowledge_heavy title, body, practice_heavy title, body, aligned title, body]
export const ACTION_CARDS = [
  ['waste', 'One-week bag challenge', 'You know why plastic is a problem but still pick it up often. Carry a cloth bag and bottle every day for one week and count the plastic you avoid.', 'Learn the three streams', 'You already segregate. Learn why wet, dry and hazardous waste need different handling so you can teach others.', 'Waste champion', 'Your waste habits match what you know. Help a friend or your class set up a segregation corner.'],
  ['water', 'Tap-off streak', 'You know water is scarce. For one week, turn the tap off while brushing and soaping, and tell a family member.', 'Why every litre counts', 'You save water by habit. Read how groundwater recharge works and why Mira-Bhayandar depends on it.', 'Water-wise', 'Knowledge and action are in step. Try spotting and reporting one leak at school or home.'],
  ['energy', 'Switch-off round', 'You understand energy use but forget the switches. Make a "last one out" switch-off check at home or in class.', 'Read your meter', 'You switch off lights already. Learn to read the electricity bill and find your biggest appliance.', 'Energy saver', 'Good alignment. Suggest an LED or daylight audit of one classroom.'],
  ['biodiversity', 'Adopt a plant', 'You know why biodiversity matters. Adopt one plant or tree near home or campus and water it every week.', 'Know your neighbours', 'You care for nature already. Learn to identify five local birds or trees.', 'Nature friend', 'Your actions match your knowledge. Join or start an eco-club plantation drive.'],
  ['climate', 'Talk it forward', 'You know the climate basics. Explain one idea to your family this week and pick one habit to change together.', 'Understand the why', 'You already live low-carbon. Read how the greenhouse effect and the Paris Agreement connect to your habits.', 'Climate aware', 'Strong alignment. Track your household food waste for a week and aim to halve it.'],
  ['air-quality', 'Clean-air pledge', 'You know how smoke harms lungs. Commit to never burning waste and ask others to switch off idling engines.', 'Read the AQI', 'You avoid polluting acts. Learn what PM2.5 and the AQI categories mean for outdoor activity.', 'Clean-air ally', 'Your habits fit your knowledge. Plant or care for a dust-trapping tree near your school.'],
  ['transport', 'Car-free day', 'You know shared and active travel cut emissions. Pick two trips this week to walk, cycle or take public transport.', 'Why it works', 'You already travel lightly. Learn how train and metro emissions compare per passenger.', 'Smart commuter', 'Alignment is good. Help classmates set up a carpool or walking group.'],
  ['local-issues', 'Creek care walk', 'You know why mangroves and wetlands matter. Join a clean-up or walk to a nearby creek and remove litter safely with an adult.', 'Learn your local story', 'You already keep your area clean. Find out about Vasai Creek mangroves and the Bhayandar wetlands.', 'Local guardian', 'Good match of knowledge and action. Share what you know with younger students.'],
];
