import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemberPicker } from './MemberPicker';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({
  apiService: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

describe('MemberPicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches only eligible members of the card project', async () => {
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { members: [{ id: 'project-user', name: 'Ana Proyecto', email: 'ana@example.com' }] },
    });
    render(<MemberPicker cardId="card-1" assignedMembers={[]}
      onMemberAssigned={jest.fn()} onMemberRemoved={jest.fn()} />);

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/api/cards/card-1/eligible-members', true));
    expect(screen.getByText('Ana Proyecto')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/miembro/i), { target: { value: 'fuera del proyecto' } });
    expect(screen.queryByText('Ana Proyecto')).toBeNull();
  });
});
