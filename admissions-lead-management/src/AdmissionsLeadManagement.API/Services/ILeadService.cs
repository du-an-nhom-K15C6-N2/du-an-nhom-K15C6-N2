using AdmissionsLeadManagement.API.DTOs;
using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.Services
{
    public interface ILeadService
    {
        Task<PagedResult<LeadResponseDto>> SearchAndFilterLeadsAsync(LeadFilterQuery query, CancellationToken cancellationToken = default);
        Task<LeadResponseDto?> GetLeadDetailsAsync(int id, CancellationToken cancellationToken = default);
        Task<List<Counselor>> GetCounselorsAsync(CancellationToken cancellationToken = default);
        Task<ConsultationNoteDto> AddConsultationNoteAsync(int leadId, int counselorId, string content, InteractionChannel channel, string outcome, DateTime? nextAppointmentDate = null);
    }
}
