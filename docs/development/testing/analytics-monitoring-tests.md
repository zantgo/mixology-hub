# Analytics & Monitoring Tests

**Example TDD for Non-blocking Analytics Execution (Domain 13):**
```typescript
describe('Analytics & Monitoring - Non-blocking execution', () => {
  it('should fire and forget analytics events without delaying HTTP response', async () => {
    const analyticsService = new AnalyticsService();
    const cocktailService = new CocktailService(analyticsService);
    
    // Mock analytics to take 2 seconds (simulate slow external datadog/newrelic)
    jest.spyOn(analyticsService, 'trackEvent').mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 2000))
    );
    
    const startTime = Date.now();
    
    // User prepares cocktail
    await cocktailService.prepare('cocktail123', 'user123');
    
    const duration = Date.now() - startTime;
    
    // Ensure the prepare method finishes in ~10ms, NOT 2000ms
    // Proving the analytics logging is detached from the request lifecycle
    expect(duration).toBeLessThan(100); 
  });
});
```