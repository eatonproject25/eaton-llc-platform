import { CanActivateChildFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateChildFn = () => {
  const hasToken = !!localStorage.getItem('access');
  return hasToken ? true : inject(Router).createUrlTree(['/auth/login']);
};
