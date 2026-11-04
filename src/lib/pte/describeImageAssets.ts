// Fase 7 (projeto 9): ativos dos gráficos de Describe Image.
// Fonte das imagens:
//  - ourworldindata-* (6 primeiras): Our World in Data (ourworldindata.org) —
//    licença CC BY 4.0, com atribuição exibida no motor.
//  - di-ai-* (projeto 18, D18-7): gráficos sintéticos ilustrativos gerados
//    para prática — série de dados fictícia, NUNCA tratada como verificada.
// Slugs espelham o campo `image` do JSON.
import co2 from "@/assets/describe-image/annual-co2-emissions-per-country.svg";
import electricity from "@/assets/describe-image/electricity-prod-source-stacked.svg";
import energy from "@/assets/describe-image/global-primary-energy.svg";
import internet from "@/assets/describe-image/share-of-individuals-using-the-internet.svg";
import lifeExpectancy from "@/assets/describe-image/life-expectancy.svg";
import measles from "@/assets/describe-image/share-of-children-vaccinated-against-measles.svg";
// Projeto 18 (D18-7): gráficos sintéticos ilustrativos.
import renewableShare from "@/assets/describe-image/renewable-share-electricity.svg";
import urbanPopulation from "@/assets/describe-image/urban-population-share.svg";
import coffeeConsumption from "@/assets/describe-image/coffee-consumption-per-capita.svg";
import evSalesShare from "@/assets/describe-image/ev-sales-share.svg";
import temperatureAnomaly from "@/assets/describe-image/global-temperature-anomaly.svg";
import waterUseSectors from "@/assets/describe-image/water-use-by-sector.svg";
import adultLiteracy from "@/assets/describe-image/adult-literacy-rate.svg";
import airTravel from "@/assets/describe-image/air-travel-passengers.svg";
import extremePoverty from "@/assets/describe-image/extreme-poverty-share.svg";
import gdpRegions from "@/assets/describe-image/gdp-per-capita-regions.svg";
import forestArea from "@/assets/describe-image/forest-area-share.svg";
import energyPerPerson from "@/assets/describe-image/energy-use-per-person.svg";
import electricityMix from "@/assets/describe-image/electricity-mix-stacked.svg";
import lifeSatisfaction from "@/assets/describe-image/life-satisfaction-income.svg";

export const DI_SOURCE_LABEL = "Our World in Data · CC BY 4.0";
/** Rótulo honesto para os gráficos sintéticos do projeto 18 (dados ilustrativos). */
export const DI_SYNTHETIC_LABEL = "Dados ilustrativos (série sintética)";

export const DESCRIBE_IMAGE_ASSETS: Record<string, string> = {
  "annual-co2-emissions-per-country": co2,
  "electricity-prod-source-stacked": electricity,
  "global-primary-energy": energy,
  "share-of-individuals-using-the-internet": internet,
  "life-expectancy": lifeExpectancy,
  "share-of-children-vaccinated-against-measles": measles,
  // Projeto 18 (D18-7): sintéticos ilustrativos.
  "renewable-share-electricity": renewableShare,
  "urban-population-share": urbanPopulation,
  "coffee-consumption-per-capita": coffeeConsumption,
  "ev-sales-share": evSalesShare,
  "global-temperature-anomaly": temperatureAnomaly,
  "water-use-by-sector": waterUseSectors,
  "adult-literacy-rate": adultLiteracy,
  "air-travel-passengers": airTravel,
  "extreme-poverty-share": extremePoverty,
  "gdp-per-capita-regions": gdpRegions,
  "forest-area-share": forestArea,
  "energy-use-per-person": energyPerPerson,
  "electricity-mix-stacked": electricityMix,
  "life-satisfaction-income": lifeSatisfaction,
};
