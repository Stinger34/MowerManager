import MowerForm from '../MowerForm';

export default function MowerFormExample() {
  // todo: remove mock functionality
  const handleSubmit = (data: any) => {
    console.log('Form submitted with data:', data);
  };

  const handleCancel = () => {
    console.log('Form cancelled');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">New Mower Form</h2>
          <MowerForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={false}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Edit Mower Form (with data)</h2>
          <MowerForm 
            initialData={{
              make: "John Deere",
              model: "X350",
              year: 2022,
              serialNumber: "JD123456",
              purchaseDate: new Date("2022-03-15"),
              purchasePrice: "2499.99",
              condition: "good",
              status: "active",
              notes: "Purchased from local dealer, excellent condition with low hours."
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={true}
          />
        </div>
      </div>
    </div>
  );
}