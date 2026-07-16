import { IRepository } from './repository.interface';

// Replace `any` with actual domain aggregate type once bound
export interface ILearningRepository extends IRepository<any> {}
export interface IWorkflowRepository extends IRepository<any> {}
export interface IAssessmentRepository extends IRepository<any> {}
export interface IRevisionRepository extends IRepository<any> {}
export interface IAnalyticsRepository extends IRepository<any> {}
export interface ISecurityRepository extends IRepository<any> {}
export interface IIntegrationRepository extends IRepository<any> {}
export interface IStudyPlanRepository extends IRepository<any> {}
export interface IAssetRepository extends IRepository<any> {}
export interface IRecommendationRepository extends IRepository<any> {}
