export enum UserRole {
  AcademicAdvisor = 'ACADEMIC_ADVISOR',
  TrainingManager = 'TRAINING_MANAGER',
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}
