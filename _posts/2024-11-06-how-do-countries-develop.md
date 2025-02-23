---
title:  How Do Countries Develop?
date:   2024-11-06 10:53:37 +0300
categories: development economy politics
permalink: /:categories/:title
---
#### *What is the role of energy and scientific advancement in the socioeconomic development of nations?*

How do countries develop? What is development? Owen Barder[^1],  argues that development is an emergent property of the socioeconomic system. He further expounds this idea by noting that development is not the sum of the well-being of people in the economy and it cannot be brought about simply by making enough people in the economy better off. Development, he argues, is instead a system-wide manifestation of the way people, firms, technologies and institutions interact with each other within the economic, social and political system. Specifically, development is the capacity of those systems to provide self-organising complexity.  Self-organising complexity in an adaptive system cannot be deliberately designed; it arises from a process of continuous adaptation and evolution.

This is a complex topic to tackle so I have narrowed down my question to just how important energy is to the development of a nation, specifically, electricity and the role of scientific advancement. This is because electrical consumption is a measure of not just the ability to utilise electricity but a measure of just how good a country’s infrastructure is because electricity is complex to generate, transmit and use and like all other forms of energy it must be reliable and cheap. Attention to scientific advancements is also important as new and more complex goods and services are developed through research and the application of newly discovered or acquired knowledge. A nation that pays attention to and deliberately funds research and development will tend to have a more advanced and complex economy.

Therefore I will be using the GDP per capita, electricity consumption per capita, economic complexity index, and the number of scientific papers published per nation to investigate my hypothesis.

Developing nations have been struggling to move to middle-income and finally high-income status. Loans, grants and donations have been poured into trying to alleviate poverty and improve the lot of these nations but sadly not much happens. Exactly what does it take to transform a struggling economy into a robust and complex one? Is it just money that is required? In this investigation, we will discover that the process of development is much more subtle than government-initiated economic projects and rather it is a complex function of the interactions between multiple systems in an organic manner that leads to a prosperous, complex and robust economy of a nation.

### Data Sources
Data was acquired and assembled from multiple online sources listed below:

1. Electricity consumption per capita (kWh) and GDP per capita ($) from the World Bank data repository[^2].
2. List of oil-producing countries from Wikipedia, scraped using R[^3].
3. Economic Complexity Index, Harvard University, (The Atlas of Economic Complexity by @HarvardGrwthLab, n.d.)[^4].
4. Democracy Index from Economist Intelligence Unit, 2023[^5].
5. Gini Coefficient by Country 2023, n.d[^6].

### Results and Discussion
[Here][dash] is the Power BI dashboard.

#### 1. Average Electricity Consumption per Capita vs Average GDP per Capita

<figure>
  <img alt="Average Electricity Consumption per Capita vs Average GDP per Capita" src="/images/elec_vs_gdp.JPG" />
  <figcaption>
   Average Electricity Consumption per Capita vs Average GDP per Capita
  </figcaption>
</figure>

<!-- | ![image](/images/elec_vs_gdp.JPG){:height="550%" width="150%"} |
|:--:|
| *Average Electricity Consumption per Capita vs Average GDP per Capita* | -->

The chart above clearly shows a strong positive correlation between GDP per capita and electricity consumption per capita. In other words, the more electricity citizens use, the more productive they are. 

#### 2. Electricity consumption per capita vs GDP per Capita for selected countries

<figure>
  <img alt="Electricity consumption per capita vs GDP per Capita for selected countries" src="/images/elec_vs_gdp_select.JPG" />
  <figcaption>
   Electricity consumption per capita vs GDP per Capita for selected countries
  </figcaption>
</figure>

This next chart examines the relationship between electricity consumption and GDP per capita between selected countries. 
Three clear categories emerge. 
1. **Developing Economies**: Represented by Kenya. These economies are struggling to improve their GDP per capita and their electricity consumption is also lagging. These nations have not made much progress in the last 30 years.

2. **Rapidly Developing Economies**: These are represented by China and Brazil. These countries are rapidly increasing their economic output, and their electricity consumption is matching this output. They are well on their way to becoming developed economies.

3. **Mature Economies**: Represented by Germany, USA and Luxembourg. These nations have high economic outputs and electrical consumption per capita however something interesting is observed here. At some point, these countries seem to be increasing their economic output while maintaining or even decreasing their electricity consumption! This is because as economies become mature they improve their efficiency and effectiveness such that they can produce more with less energy. This is the ultimate goal of every economy.

#### 3. GDP per Capita vs Economic Complexity Index

<figure>
  <img alt="GDP per Capita vs Economic Complexity Index" src="/images/gdp_vs_eci.JPG" />
  <figcaption>
   GDP per Capita vs Economic Complexity Index
  </figcaption>
</figure>

From the above chart, there is another strong positive correlation between GDP per capita and Economic complexity. There are some exceptions like Qatar, the UAE, Kuwait etc. These can be explained by the presence of oil deposits that these countries export thus they do not need to have complex economies to have a high GDP per capita. However, their goal should be to invest their income in creating a sufficiently advanced and complex economy to buffer themselves against upsets in their major export. Suppose a new source of energy is discovered or invented that will replace oil. Or perhaps their deposits run out? What then? 
To flourish a nation needs to generate wealth consistently, and the way to create more is through innovation. Innovation is essential to African stability and growth in the upcoming decades. Currently, much of that wealth creation is the creation of microenterprises, small businesses that only employ one or two people[^7].

#### 4. Number of Scientific Publications per Country

<figure>
  <img alt="Number of Scientific Publications per Country" src="/images/publications_per_country.JPG" />
  <figcaption>
   Number of Scientific Publications per Country
  </figcaption>
</figure>

This chart shows the number of scientific publications per country (for the selected countries) per year from 2000 to 2018. The notable development here is the meteoric rise of scientific publications in China, which is in tandem with its economic growth. India and Brazil, other rapidly developing nations, are also following the Chinese path of investing in research and development as their engine for economic growth.

#### 5. Electricity Consumption per Capita vs Economic Complexity Index

<figure>
  <img alt="Electricity Consumption per Capita vs Economic Complexity Index" src="/images/elec_vs_eci.JPG" />
  <figcaption>
   Electricity Consumption per Capita vs Economic Complexity Index
  </figcaption>
</figure>

Here we see a strong positive correlation between electricity consumption per capita and the Economic Complexity Index. The more complex goods and services an economy can produce and export the higher its electricity consumption i.e. one man in an advanced automated factory can produce more and higher quality products than several workers labouring in the sun in a developing economy. Here again, we see that the more mature economies can increase their economic complexity without necessarily increasing their electricity consumption because they are now becoming more efficient and effective. As for the still developing nations, until they become mature economies, it seems the best way to develop is to increase their electricity consumption.

#### 6. Scientific Papers Published vs. Economic Complexity Index

<figure>
  <img alt="Scientific Papers Published vs. Economic Complexity Index" src="/images/papers_vs_eci.JPG" />
  <figcaption>
   Scientific Papers Published vs. Economic Complexity Index
  </figcaption>
</figure>

From this chart, we can conclude that one of the best ways to create a complex economy is to invest in research and development. China, which has invested heavily in research and development for the past two decades has seen a corresponding rise in the complexity of the goods and services it produces and exports. Japan, Germany, the UK e.t.c. also demonstrate highly complex economies in tandem with their high GDP per capita.

#### Conclusion

From this investigation, we can conclude the following:
1. To move from developing to rapidly developing and finally to a mature developed economy, a nation must lay the necessary groundwork in terms of access to cheap and reliable energy for its citizens. There is no substitute for this step. Every nation first has to harness energy to multiply the productivity of its workers to develop. We have seen how China and other rapidly developing nations are doing this and we have seen how Kenya has remained stagnant because of not taking this step.

2. For long-term economic gains, a nation must invest in high-quality education, research and the development of new products/ ideas from the research. This is a precursor to developing a complex economy and there is no escaping this. No amount of external loans or grants will ever replace this. A nation has to develop and deploy intellectual property to develop complexity in the economy. The Americans for example applied physics to the development of the atomic bomb and from this, they won the Second World War, catapulted themselves into a superpower and developed several other technologies from this research like nuclear weapons. Their military also developed the internet and now the USA is reaping huge dividends from the internet.

3. Nations also have to intentionally set the stage for organic economic complexity i.e. systems that work, and the freedom to work and be creative. Something simple like the physical addressing system in the Western world enabled the establishment of efficient and effective delivery systems like Amazon. Their political system of democracy and freedom for all also encourages their populace to be daring and entrepreneurial in their pursuits and also attracts immigrants from all over the world who go to these countries and add value to their economies. Contrast this with China which has a capitalistic economic system but a socialist political system. China is certainly making rapid development progress but how sustainable is it? Does it attract the best and brightest from other cultures?

4. Finally, there has been a lot of talk and action in the climate change area. Mature economies have become more conscious of their energy footprints and are taking steps towards becoming more energy efficient and that is why we see them increasing their GDP per capita without a corresponding increase in electricity consumption. As for developing nations, this may be difficult as the data suggests that first, you have to multiply your worker productivity by consuming more energy per capita until your economy stabilizes then you can begin taking steps towards efficiency. It is like teaching a baby to first walk in halting unsteady steps before they can properly walk then now they can learn to run fast and efficiently. From this, I would like to caution developing countries to be careful when adopting green energy policies copied from developing nations since they are not operating in the same economic environment as the mature economies. The most important thing for developing nations is first to multiply worker productivity then, economic complexity and finally efficiency.


[^1]: https://www.cgdev.org/blog/what-development
[^2]: https://data.worldbank.org/
[^3]: https://en.wikipedia.org/wiki/List_of_countries_by_oil_production
[^4]: https://atlas.cid.harvard.edu/rankings
[^5]: https://www.eiu.com/n/campaigns/democracy-index-2022/
[^6]: https://worldpopulationreview.com/country-rankings/gini-coefficient-by-country
[dash]: https://app.powerbi.com/groups/me/reports/4612f545-418e-4f89-8f22-4b4e964cc05b/ReportSectione390957330933048a7a1
[^7]: Makhtar Diop, World Bank’s Vice President for Africa. (2017, December 1). Innovation in Africa. World Bank. https://www.worldbank.org/en/news/speech/2017/11/30/innovation-in-africa 
