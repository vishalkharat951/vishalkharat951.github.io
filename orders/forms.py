from django import forms

from .models import Order


class CheckoutForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ['full_name', 'mobile_number', 'address']
        widgets = {
            'full_name': forms.TextInput(attrs={'placeholder': 'John Doe'}),
            'mobile_number': forms.TextInput(attrs={'placeholder': '+1 (555) 123-4567'}),
            'address': forms.Textarea(attrs={
                'rows': 4,
                'placeholder': 'Street, City, State, Postal Code, Country',
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control form-control-lg'
