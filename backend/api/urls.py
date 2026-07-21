from django.urls import path
from .views import PlanTripAPIView, HistoryAPIView, DriverAPIView, CompleteTripAPIView

urlpatterns = [
    path('plan-trip/', PlanTripAPIView.as_view(), name='plan-trip'),
    path('history/', HistoryAPIView.as_view(), name='history'),
    path('driver/<str:driver_id>/', DriverAPIView.as_view(), name='driver-detail'),
    path('complete-trip/', CompleteTripAPIView.as_view(), name='complete-trip'),
]
