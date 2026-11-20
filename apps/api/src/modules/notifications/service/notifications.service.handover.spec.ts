import { NotificationsService } from './notifications.service';

describe('NotificationsService.handOver', () => {
  const make = (handOver: jest.Mock) => new NotificationsService({ handOver } as never, {} as never, {} as never);

  it('passes the paths of the record to the repository and returns how many moved', async () => {
    const handOver = jest.fn().mockResolvedValue(3);
    const moved = await make(handOver).handOver('org', 'old', 'new', ['/candidates/c1', '/jobs/j1'], ['co']);
    expect(moved).toBe(3);
    expect(handOver).toHaveBeenCalledWith('org', 'old', 'new', ['co'], ['/candidates/c1', '/jobs/j1']);
  });

  it('does nothing when the owner did not change', async () => {
    const handOver = jest.fn();
    expect(await make(handOver).handOver('org', 'same', 'same', ['/candidates/c1'])).toBe(0);
    expect(handOver).not.toHaveBeenCalled();
  });

  it('never fails the transfer: an error is swallowed', async () => {
    const handOver = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(make(handOver).handOver('org', 'old', 'new', ['/candidates/c1'])).resolves.toBe(0);
  });
});
