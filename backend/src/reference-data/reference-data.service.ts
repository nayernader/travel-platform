import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Airport, AirportDocument } from './schemas/airport.schema';
import { Attraction, AttractionDocument } from './schemas/attraction.schema';
import { City, CityDocument } from './schemas/city.schema';
import { Country, CountryDocument } from './schemas/country.schema';

@Injectable()
export class ReferenceDataService {
  constructor(
    @InjectModel(Country.name) private readonly countries: Model<CountryDocument>,
    @InjectModel(City.name) private readonly cities: Model<CityDocument>,
    @InjectModel(Airport.name) private readonly airports: Model<AirportDocument>,
    @InjectModel(Attraction.name) private readonly attractions: Model<AttractionDocument>,
  ) {}

  listCountries() {
    return this.countries.find().sort({ name: 1 });
  }

  listCities(countryCode?: string) {
    return this.cities.find(countryCode ? { countryCode } : {}).sort({ name: 1 });
  }

  listAirports(cityId?: string) {
    return this.airports.find(cityId ? { cityId } : {}).sort({ _id: 1 });
  }

  listAttractions(cityId?: string) {
    return this.attractions.find(cityId ? { cityId } : {}).sort({ name: 1 });
  }

  // Used by other modules, e.g. to convert flight times with the airport's time zone
  findAirport(iata: string) {
    return this.airports.findById(iata.toUpperCase());
  }
}