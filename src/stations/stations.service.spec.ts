import { Test, TestingModule } from '@nestjs/testing';
import { GetStationsFilterDto } from './dto/get-station-filter.dto';
import { StationWebSocket } from './station-websocket';
import { Station } from './station.entity';
import { StationRepository } from './station.repository';
import { StationsService } from './stations.service';

jest.mock('ws');

const mockStationRepository = () => ({
  getStations: jest.fn(),
  findOne: jest.fn(),
  createStation: jest.fn(),
  updateStation: jest.fn(),
});

describe('StationsService', () => {
  let stationService: StationsService;
  let stationRepository: StationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StationsService,
        {
          provide: StationRepository,
          useFactory: mockStationRepository,
        },
      ],
    }).compile();

    stationService = module.get<StationsService>(StationsService);
    stationRepository = module.get<StationRepository>(StationRepository);
  });

  describe('get stations', () => {
    it('gets all stations from the repository', async () => {
      const station = new Station();

      const getStationFn = stationRepository.getStations as jest.Mock;
      getStationFn.mockResolvedValue([station]);

      const filterDto = {};

      const result = await stationService.getStations(filterDto);

      expect(getStationFn).toHaveBeenCalled();

      expect(result).toEqual([station]);
    });

    it('get stations with filter by identity', () => {
      const filterDto: GetStationsFilterDto = { identity: 'ABC' };

      stationService.getStations(filterDto);

      expect(stationRepository.getStations).toHaveBeenCalledWith(filterDto);
    });
  });

  describe('get stations by id', () => {
    it('calls stationRepository.findOne() and successfully retrieve and return the station', async () => {
      const findOneFn = stationRepository.findOne as jest.Mock;
      const station = new Station();
      findOneFn.mockResolvedValue(station);

      const stationId = 1;
      const result = await stationService.getStationById(stationId);

      expect(findOneFn).toHaveBeenCalledWith(stationId);
      expect(result).toEqual(station);
    });

    it('throws an error as station is not found', () => {
      const findOneFn = stationRepository.findOne as jest.Mock;
      findOneFn.mockResolvedValue(null);

      expect(stationService.getStationById(1)).rejects.toThrow();
    });
  });

  describe('create station', () => {
    it('calls stationRepository.createStation() and returns the result', async () => {
      const createStationFn = stationRepository.createStation as jest.Mock;
      const station = new Station();
      createStationFn.mockResolvedValue(station);
      const connectStationToCentralSystemFn = jest
        .spyOn(stationService, 'connectStationToCentralSystem')
        .mockImplementation(_ => Promise.resolve(undefined));

      const result = await stationService.createStation({});

      expect(createStationFn).toHaveBeenCalledWith({});
      expect(result).toEqual(station);
      expect(connectStationToCentralSystemFn).toHaveBeenCalledWith(station);
    });
  });

  describe('update station', () => {
    it('calls stationRepository.update() and returns the result', async () => {
      const station = new Station();
      station.id = 1;
      stationService.getStationById = jest.fn().mockResolvedValue(station);
      const updateStationFn = stationRepository.updateStation as jest.Mock;
      updateStationFn.mockResolvedValue(station);

      const result = await stationService.updateStation(station.id, {});

      expect(updateStationFn).toHaveBeenCalledWith(station, {});
      expect(result).toEqual(station);
    });
  });

  describe('station websocket connection', () => {
    it('connects a station its central system url', () => {
      expect(stationService.connectedStations.length).toStrictEqual(0);
      const station1 = new Station();
      stationService.connectStationToCentralSystem(station1);
      expect(stationService.connectedStations.length).toStrictEqual(1);
      const station2 = new Station();
      stationService.connectStationToCentralSystem(station2);
      expect(stationService.connectedStations.length).toStrictEqual(2);
    });

    it('connects all stations to central system url', async () => {
      const station1 = new Station();
      station1.identity = 'station1';
      const station2 = new Station();
      station2.identity = 'station2';
      stationService.connectStationToCentralSystem = jest
        .fn()
        .mockImplementation();
      stationService.getStations = jest
        .fn()
        .mockResolvedValue([station1, station2]);

      await stationService.connectAllStationsToCentralSystem();

      [station1, station2].forEach(station => {
        expect(
          stationService.connectStationToCentralSystem,
        ).toHaveBeenCalledWith(station);
      });
    });

    it('connects all stations to central system url but filtered out already connected stations', async () => {
      const station1 = new Station();
      station1.identity = 'station1';
      const station2 = new Station();
      const socketForStation2 = new StationWebSocket(station2);
      socketForStation2.wsClient.readyState = 1;

      stationService.connectedStations.push(socketForStation2);
      stationService.connectStationToCentralSystem = jest
        .fn()
        .mockImplementation();
      stationService.getStations = jest
        .fn()
        .mockResolvedValue([station1, station2]);

      await stationService.connectAllStationsToCentralSystem();

      expect(
        stationService.connectStationToCentralSystem,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
